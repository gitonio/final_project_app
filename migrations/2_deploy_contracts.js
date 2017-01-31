module.exports = function(deployer) {
  //deployer.deploy(FundingHub);
  deployer.deploy(FundingHub,{gas: 4550000}).then( function(){
    return FundingHub.deployed().createProject(web3.eth.accounts[1],15,3, 'World Peace',{gas: 4550000});
  });
  
};
