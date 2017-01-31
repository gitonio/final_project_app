web3.eth.getTransactionReceiptMined = function (txnHash, interval) {
    var transactionReceiptAsync;
    interval = interval ? interval : 500;
    transactionReceiptAsync = function(txnHash, resolve, reject) {
        try {
            var receipt = web3.eth.getTransactionReceipt(txnHash);
            if (receipt == null) {
                setTimeout(function () {
                    transactionReceiptAsync(txnHash, resolve, reject);
                }, interval);
            } else {
                resolve(receipt);
            }
        } catch(e) {
            reject(e);
        }
    };

    if (Array.isArray(txnHash)) {
        var promises = [];
        txnHash.forEach(function (oneTxHash) {
            promises.push(web3.eth.getTransactionReceiptMined(oneTxHash, interval));
        });
        return Promise.all(promises);
    } else {
        return new Promise(function (resolve, reject) {
                transactionReceiptAsync(txnHash, resolve, reject);
            });
    }
};

// Found here https://gist.github.com/xavierlepretre/afab5a6ca65e0c52eaf902b50b807401
var getEventsPromise = function (myFilter, count) {
  return new Promise(function (resolve, reject) {
    count = count ? count : 1;
    var results = [];
    myFilter.watch(function (error, result) {
      if (error) {
        reject(error);
      } else {
        count--;
        results.push(result);
      }
      if (count <= 0) {
        resolve(results);
        myFilter.stopWatching();
      }
    });
  });
};

contract('FundingHub', function(accounts) {

    it("Should have a seeded project that can be funded and refunded.", function() {
        var fh = FundingHub.deployed();
        var project;
        var pa;
        fh.projects(0).then(function(address) {
            pa = address;
            project = Project.at(address);
            assert.equal(web3.eth.getBalance(pa).toNumber(), 0, 'Seeded project did not start out with zero balance.')
	        return project.proposal(0)
        })
        .then(function(proj){
            assert.equal(proj[0].valueOf(), accounts[1], 'accounts[1] was not the owner.')
            assert.equal(proj[1].valueOf(), 15, '15 was not the goal')
            assert.equal(proj[2].valueOf(), 3, '3 was not the deadline')
            assert.equal(proj[4].valueOf(), 0, '0 was not the amount reached')
            assert.equal(proj[5].valueOf(), 0, '0 was not the id')
            assert.equal(proj[6].valueOf(), false, 'false was not the payout')
            assert.equal(proj[7], 'World Peace', 'World Peace was not the project');
        })
        .then(function () {
            return fh.contribute(0,5, {from: accounts[2], value: 5, gas:300000});
        })
        .then(function (txnHash) {
            return web3.eth.getTransactionReceiptMined(txnHash);
        })
        .then(function (receipt) {
            assert.equal(web3.eth.getBalance(pa).toNumber(),5, '5 was not the project balance.')
        })
        .then(function () {
            return fh.contribute(0,5, {from: accounts[3], value: 5, gas:300000});
        })
        .then(function (txnHash) {
            return web3.eth.getTransactionReceiptMined(txnHash);
        })
        .then(function (receipt) {
            console.log(receipt);
            assert.equal(web3.eth.getBalance(pa).toNumber(),10, '10 was not the project balance.')
        })
        .then(function(){
            blockNumber = web3.eth.blockNumber + 1;
            return project.refund();
        })
        .then(function (txnHash) {
      	    return Promise.all([
	    		      getEventsPromise(project.logRefund(
	    			    {},
	    			    { fromBlock: blockNumber, toBlock: "latest" })),
	    		    web3.eth.getTransactionReceiptMined(txnHash)
    	    ]);
        })
        .then(function (receipt) {
            console.log(receipt);
            assert.equal(web3.eth.getBalance(pa),0,"Project balance wasnt refunded.");
        })

    });

});
