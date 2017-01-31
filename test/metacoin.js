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

contract('MetaCoin', function(accounts) {
  it("should put 10000 MetaCoin in the first account", function() {
    var meta = MetaCoin.deployed();

    return meta.getBalance.call(accounts[0]).then(function(balance) {
      assert.equal(balance.valueOf(), 10000, "10000 wasn't in the first account");
    });
  });
  it("should call a function that depends on a linked library  ", function(){
    var meta = MetaCoin.deployed();
    var metaCoinBalance;
    var metaCoinEthBalance;

    return meta.getBalance.call(accounts[0]).then(function(outCoinBalance){
      metaCoinBalance = outCoinBalance.toNumber();
      return meta.getBalanceInEth.call(accounts[0]);
    }).then(function(outCoinBalanceEth){
      metaCoinEthBalance = outCoinBalanceEth.toNumber();

    }).then(function(){
      assert.equal(metaCoinEthBalance,2*metaCoinBalance,"Library function returned unexpeced function, linkage may be broken");

    });
  });
  it("should send coin correctly", function() {
    var meta = MetaCoin.deployed();

    // Get initial balances of first and second account.
    var account_one = accounts[0];
    var account_two = accounts[1];

    var account_one_starting_balance;
    var account_two_starting_balance;
    var account_one_ending_balance;
    var account_two_ending_balance;

    var amount = 10;

    return meta.getBalance.call(account_one).then(function(balance) {
      account_one_starting_balance = balance.toNumber();
      return meta.getBalance.call(account_two);
    }).then(function(balance) {
      account_two_starting_balance = balance.toNumber();
      return meta.sendCoin(account_two, amount, {from: account_one});
    }).then(function() {
      return meta.getBalance.call(account_one);
    }).then(function(balance) {
      account_one_ending_balance = balance.toNumber();
      return meta.getBalance.call(account_two);
    }).then(function(balance) {
      account_two_ending_balance = balance.toNumber();

      assert.equal(account_one_ending_balance, account_one_starting_balance - amount, "Amount wasn't correctly taken from the sender");
      assert.equal(account_two_ending_balance, account_two_starting_balance + amount, "Amount wasn't correctly sent to the receiver");
    });
  });

  it("should transfer coins", function() {

  var meta = MetaCoin.deployed();
  var account_one = accounts[0];
  var account_two = accounts[2];

  return meta.sendCoin.call(account_two, 6, { from: account_one })
    .then(function (sufficient) {
      if (!sufficient) {
        throw "Insufficient coins";
      }
      return meta.sendCoin(account_two, 6, { from: account_one });
    })
    .then(function (txnHash) {
      return web3.eth.getTransactionReceiptMined(txnHash);
    })
    .then(function (receipt) {
      return meta.getBalance.call(account_two);
    })
    .then(function (balance) {
      console.log('1st:'+balance);
      assert.equal(balance, 6, "Should have received 6 coins");
    });

});

it("should transfer multi coins", function() {

  var meta = MetaCoin.deployed();
  var account_one = accounts[0];
  var account_two = accounts[1];
  var account_three = accounts[2];

  return meta.sendCoin.call(account_two, 6, { from: account_one })
    .then(function (sufficient) {
      if (!sufficient) {
        throw "Insufficient coins";
      }
      return Promise.all([
        meta.sendCoin.sendTransaction(account_two, 6, { from: account_one }),
        meta.sendCoin.sendTransaction(account_three, 4, { from: account_one })
      ]);
    })
    .then(function (txnHashes) {
      return web3.eth.getTransactionReceiptMined(txnHashes);
    })
    .then(function (receipts) {
      return meta.getBalance.call(account_two);
    })
    .then(function (balance) {
      console.log('2nd:'+balance);
      assert.equal(balance.valueOf(), 16, "Should have received 6 coins");
    });

});
});
