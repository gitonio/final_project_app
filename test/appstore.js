// Found here https://gist.github.com/xavierlepretre/88682e871f4ad07be4534ae560692ee6
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

// Found here https://gist.github.com/xavierlepretre/d5583222fde52ddfbc58b7cfa0d2d0a9
var expectedExceptionPromise = function (action, gasToUse) {
  return new Promise(function (resolve, reject) {
      try {
        resolve(action());
      } catch(e) {
        reject(e);
      }
    })
    .then(function (txn) {
      return web3.eth.getTransactionReceiptMined(txn);
    })
    .then(function (receipt) {
      // We are in Geth
      assert.equal(receipt.gasUsed, gasToUse, "should have used all the gas");
    })
    .catch(function (e) {
      if ((e + "").indexOf("invalid JUMP") > -1) {
        // We are in TestRPC
      } else {
        throw e;
      }
    });
};

contract('AppStore', function(accounts) {
  var appStore ;

  beforeEach(function() {
  //AppStore.setNetwork('42');

    appStore = AppStore.deployed();
  });


  it("should start with empty product list", function() {
 
    return appStore.count.call()
	    .then(function(count) {
	      assert.equal(count.valueOf(), 0, "should start with no product");
	    });
  });

  it("should not add a product if not owner", function() {
    console.log(appStore.address)
    return expectedExceptionPromise(function () {
			return appStore.addProduct.call(1, 'shirt', 10, 'walmart', 1,
				{ from: accounts[1], gas: 3000000 });    	
	    },
	    3000000);
  });



  it("should be possible to add a product", function() {
    var blockNumber;
    
    return appStore.addProduct.call(1, "shirt", 10, 'walmart', 1, { from: accounts[0] })
	    .then(function(successful) {
	      assert.isTrue(successful, "should be possible to add a product");
	      blockNumber = web3.eth.blockNumber + 1;
	      return appStore.addProduct(1, "shirt1", 10, 'walmart', 1, { from: accounts[0] });
	    })
      
	    .then(function(tx) {
	    	return Promise.all([
	    		getEventsPromise(appStore.LogProductAdded(
	    			{},
	    			{ fromBlock: blockNumber, toBlock: "latest" })),
	    		web3.eth.getTransactionReceiptMined(tx)
    		]);
	    })
      
	    .then(function (eventAndReceipt) {
	    	var eventArgs = eventAndReceipt[0][0].args;
	    	assert.equal(eventArgs.id.valueOf(), 1, "should be the product id");
	    	assert.equal(eventArgs.name, "shirt1", "should be the product name");
	    	assert.equal(eventArgs.price.valueOf(), 10, "should be the product price");
	    	assert.equal(eventArgs.affiliate_name, "walmart", "should be the affiliate name");
	    	return appStore.count.call();
	    })
      
	    .then(function(count) {
	      assert.equal(count.valueOf(), 1, "should have add a product");
	      return appStore.ids(0);
	  	})
	  	.then(function (id) {
	  	  assert.equal(id.valueOf(), 1, "should be the first id");
	      return appStore.products(1);
	    })
	    .then(function(values) {
	    	assert.equal(values[0], "shirt1", "should be the product name");
	    	assert.equal(values[1].valueOf(), 10, "should be the product price");
	    	assert.equal(values[2], "walmart", "should be the affiliate name");
	    });
  });

  it("should be possible to remove a product", function(){
 
 
    return Promise.all([
      
      appStore.addProduct(11, "shirt", 10, 'walmart', 1,{ from: accounts[0] }),
      appStore.addProduct( 2, "pant",  10, 'walmart', 1,{ from: accounts[0] }),
      appStore.addProduct( 3, "sock",  10, 'walmart', 1,{ from: accounts[0] })
    ])
   .then(function(txnHashes){
      //console.log('Getting Receipt');
      //console.log(txnHashes);
     return web3.eth.getTransactionReceiptMined(txnHashes,1);
   })  
    .then(function(){
      //console.log('getting count');
      return appStore.count.call();
    })
	    .then(function(count) {
	      //console.log('count:' + count.valueOf());
	      assert.equal(count.valueOf(), 4, "should have 4 products");
	  	})      
	    .then(function() {
	      //console.log('removing');
        return appStore.removeProduct(3, {from: accounts[0]});
	  	})
      .then(function(txnHashes){
      //console.log('Getting Receipt');
      //console.log(txnHashes);
     return web3.eth.getTransactionReceiptMined(txnHashes);
   })  
    .then(function(){
      //console.log('getting count');
      return appStore.count.call();
    })
	    .then(function(count) {
	      //console.log('count:' + count.valueOf());
	      assert.equal(count.valueOf(), 3, "should have 3 products");
        return appStore.ids(0);
	  	})
	  	.then(function (id) {
	  	  assert.equal(id.valueOf(), 1, "should be the first id");
	      return appStore.products(1);
	    })
	    .then(function(values) {
	    	assert.equal(values[0], "shirt1", "should be the product name");
	    	assert.equal(values[1].valueOf(), 10, "should be the product price");
	    	assert.equal(values[2], "walmart", "should be the affiliate name");
	    });

    });

  

  it("should not be possible to purchase a product below price", function() {

    return expectedExceptionPromise(function () {
			return appStore.buyProduct.call(
					1, 1,
					{ from: accounts[1], value: 9, gas: 3000000 });    	
		    },
		    3000000);

  });

  it("should be possible to purchase a product at exact price", function() {

    return appStore.buyProduct.call(1,1, { from: accounts[1], value: 10 })
    	.then(function (successful) {
    		assert.isTrue(successful, "should be possible to purchase");
    	});

  


  });


  it("should identify number in array", function(){
    return appStore.indexOf.call(22,[1,11,22,33],{from: accounts[0]})
      .then(function (id){
        assert.equal(id.valueOf(),2,"should be the index");
      });
  });

  it("should identify last number in array", function(){
    return appStore.indexOf.call(33,[1,11,22,33],{from: accounts[0]})
      .then(function (id){
        assert.equal(id.valueOf(),3,"should be the index");
      });
  });
  
  it("Should add an affiliate", function(){
     var blockNumber;
    
    return appStore.addAffiliate.call(1, "Walmart", accounts[9], { from: accounts[0] })
	    .then(function(successful) {
        //console.log('1');
	      assert.isTrue(successful, "should be possible to add an affiliate");
	      blockNumber = web3.eth.blockNumber + 1;
	      return appStore.addAffiliate(1, "walmart", accounts[9], { from: accounts[0] });
	    })
	    .then(function(tx) {
        //console.log('2');
        console.log(tx);
	    	return Promise.all([
	    		getEventsPromise(appStore.LogAffiliateAdded(
	    			{},
	    			{ fromBlock: blockNumber, toBlock: "latest" })),
	    		web3.eth.getTransactionReceiptMined(tx)
    		]);
	    })
	    .then(function (eventAndReceipt) {
        //console.log('3');
        console.log(eventAndReceipt);
	    	var eventArgs = eventAndReceipt[0][0].args;
        console.log(eventArgs);
	    	assert.equal(eventArgs.id.valueOf(), 1, "should be the affiliate id");
	    	assert.equal(eventArgs.name, "walmart", "should be the affiliate name");
	    	assert.equal(eventArgs.affiliate_address, accounts[9], "should be the affiliate address");
	    	return appStore.affiliate_count.call();
	    })
	    .then(function(count) {
        //console.log('4');
	      assert.equal(count.valueOf(), 1, "should have added an affiliate");
	      return appStore.affiliate_ids(0);
	  	})
	  	.then(function (id) {
	       //console.log('5');
  	    assert.equal(id.valueOf(), 1, "should be the first id");
	      return appStore.affiliate_names(0);
	    })
	    .then(function(values) {
	       //console.log('6');
    	    assert.equal(values, "walmart", "should be the affiliate name");
          return appStore.getAffiliateAddress.call(1, { from: accounts[0] })
	    })
	    .then(function(values) {
	       //console.log('6');
    	   assert.equal(values, accounts[9], "should be address");
      });
 });

  it("should should transfer half of funds to affiliate after purchase", function() {
    var affiliate_beneficiary;
    var balance;

    return appStore.getAffiliateAddress.call(1, { from: accounts[0] })
    	.then(function (addr) {
        //console.log('addr:'+addr);
        affiliate_beneficiary = addr;
    		assert.equal(addr, accounts[9], "should be correct address");
        return web3.eth.getBalance(affiliate_beneficiary);
    	})
	    .then(function(value) {
	       console.log(value.valueOf());
         console.log(value.toNumber());
         balance = value.toNumber();
        return appStore.buyProduct(1,1, { from: accounts[1], value: 10 });
      })
      .then(function(tx){
        //console.log(tx);
        return Promise.all([
        	  web3.eth.getTransactionReceiptMined(tx)]);
      })
      .then(function(eventAndReceipt){
        //console.log(eventAndReceipt);
        return web3.eth.getBalance(affiliate_beneficiary).valueOf();
      })
      .then(function(value){
        console.log(value);
        console.log(balance + 5);
        assert.equal(value, balance + 5, "balance should increase by 5")
      //return web3.eth.getBalance(addr).toNumber();
  
      });


  });


});