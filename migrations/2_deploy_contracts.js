module.exports = function(deployer) {
/*
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

  //deployer.deploy(FundingHub);

  deployer.deploy(FundingHub,{gas: 4550000}).then( function(){
      console.log("fh address:"+FundingHub.deployed().address);
    return FundingHub.deployed().createProject(web3.eth.accounts[1],15,3, 'World Peace',{from: web3.eth.accounts[0], gas: 4550000});
    //return FundingHub.deployed().projects(0);
  })
       .then(function (txnHash) {
            return web3.eth.getTransactionReceiptMined(txnHash);
        })
        .then(function (receipt) {
            //assert.equal(web3.eth.getBalance(pa).toNumber(),5, '5 was not the project balance.')
    return FundingHub.deployed().projects(0);
  })
  .then( function(ra){
    console.log('Project address:'+ra);
  })
  ;
*/


    deployer.deploy(FundingHub).then( function(){
      //console.log("fh address:"+FundingHub.deployed().address);
    FundingHub.deployed().createProject(web3.eth.accounts[1],15,3, 'World Peace',{gas: 4550000});
  })
   ;

/*
deployer.deploy(FundingHub);
*/
};
