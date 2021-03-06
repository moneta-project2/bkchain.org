/*
    electrum.js : Electrum deterministic wallet implementation (public domain)
*/

function electrum_extend_chain(pubKey, privKey, mode, n, fromPrivKey) {
    var curve = getSECCurveByName("secp256k1");
    var mpk = pubKey.slice(1);
    var bytes = Crypto.charenc.UTF8.stringToBytes(n + ':' + mode + ':').concat(mpk);
    var sequence = Crypto.SHA256(Crypto.SHA256(bytes, {asBytes: true}), {asBytes: true})
    var secexp = null;
    var pt = ECPointFp.decodeFrom(curve.getCurve(), pubKey);

    if (fromPrivKey) {
        var A = BigInteger.fromByteArrayUnsigned(sequence);
        var B = BigInteger.fromByteArrayUnsigned(privKey);
        var C = curve.getN();
        secexp = A.add(B).mod(C);
        pt = pt.add(curve.getG().multiply(A));
    } else {
        var A = BigInteger.fromByteArrayUnsigned(sequence);
        pt = pt.add(curve.getG().multiply(A));
    }

    var newPriv = secexp ? secexp.toByteArrayUnsigned(): [];
    for(;newPriv.length<32;) newPriv.unshift(0x00);
    var newPub = pt.getEncoded();
    var h160 = Bitcoin.Util.sha256ripe160(newPub);
    var addr = new Bitcoin.Address(h160);
    var sec = secexp ? new Bitcoin.Address(newPriv) : '';
    if (secexp)
        sec.version = wif_version;

    return [addr.toString(), sec.toString(), newPub, newPriv];
}

function electrum_get_pubkey(privKey) {
    var curve = getSECCurveByName("secp256k1");
    var secexp = BigInteger.fromByteArrayUnsigned(privKey);
    var pt = curve.getG().multiply(secexp);
    var pubKey = pt.getEncoded();
    return pubKey;
}

ElectrumGenerator = function(pubKey, privKey, mode, start, end, update, success) {
    var timeout;
    var onUpdate = update;
    var onSuccess = success;
	
    function calcAddr(counter, maxcounter) {
        var r = electrum_extend_chain(pubKey, privKey, mode, counter, typeof privKey != 'undefined');
        onUpdate(r);
        if (counter + 1 < maxcounter) {
            timeout = setTimeout(function() { calcAddr(counter + 1, maxcounter); }, 0);
        } else {
            if (onSuccess) 
                onSuccess();
        }
    }

	this.stop = function() {
        clearTimeout(timeout);
    }
	
	calcAddr(start, end);
	
	return this;
};

var Electrum = new function () {
    var seedRounds = 100000;
	//var seedRounds = 10;
    var seed;
    var oldseed;
    var pubKey;
    var privKey;
    var rounds;
    var timeout;
    var onUpdate;
    var onSuccess;

    function calcSeed() {
        if (rounds < seedRounds) {
            var portion = seedRounds / 100;
            onUpdate(rounds * 100 / seedRounds, seed);
            for (var i = 0; i < portion; i++)
                seed = Crypto.SHA256(seed.concat(oldseed), {asBytes: true});
            rounds += portion;
            if (rounds < seedRounds) {
                timeout = setTimeout(calcSeed, 0);
            } else {
                privKey = seed;
                pubKey = electrum_get_pubkey(privKey);
                onSuccess(privKey, pubKey);
            }
        }
    }

    this.init = function(_seed, update, success) {
        seed = Crypto.charenc.UTF8.stringToBytes(_seed);
        oldseed = seed.slice(0);
        rounds = 0;
        onUpdate = update;
        onSuccess = success;
        clearTimeout(timeout);
        calcSeed();
    };

    this.initPublic = function(_pubKey) {
        pubKey = _pubKey;
    };
	
	this.gen = function(mode, start, end, update, success) {
		return new ElectrumGenerator(pubKey, privKey, mode, start, end, update, success);
    };

    this.stop = function() {
        clearTimeout(timeout);
    }

    return this;
};

function electrum_test() {

    Electrum.init('12345678', function(r) {console.log(r);},
        function(privKey) {Electrum.gen(5, function(r) {console.log(r);});});

    /*
    1DLHQhEuLftmAMTiYhw4DvVWhFQ9hnbXio
    1HvoaBYqebPqFaS7GEZzywTaiTrS8cSaCF
    1KMtsVJdde66kjgaK5dcte3TiWfFBF2bC7
    159zjjZB3TadPXE3oeei5MfxTCYu5bqDCd
    1H4uQ5i3MWSiUdHLJiPop9HWw2fe96CrLR
    1EkX2PAY21FuqsKVirZS6wkLkSwbbE4EFD
    */
}
