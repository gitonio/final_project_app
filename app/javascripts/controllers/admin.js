var app = angular.module("fundingHubApp");

/*
app.config(function ($locationProvider) {
  $locationProvider.html5Mode(true);
});
*/

app.controller("AdminController", function( $scope, $timeout, $q, projectListService){
	console.log("AdminController");
	console.log(projectListService);
	$scope.accounts = web3.eth.accounts;
	$scope.account = $scope.accounts[0];
	$scope.projects = projectListService.projects;
	initUtils(web3);



	$scope.addProject = function( owner,name, goal, deadline) {
		console.log(FundingHub.deployed());
		$scope.next_project_id = 0;
		FundingHub.deployed().count.call().then(function(rv){ return rv + 1;})
		FundingHub.deployed()
			.createProject(
				
				owner,
				goal,
				deadline,
				name,
				{ from: $scope.account, gas: 3000000 })
			.then(function (tx) {
				console.log(tx);
				return web3.eth.getTransactionReceiptMined(tx);
			})
			.then(function (receipt) {
				console.log(receipt);
				return FundingHub.deployed().count.call();
			})
			.then( function(count) {

				console.log('name'+ name);
				console.log('next project no:'+count);
			var o = {name: name, id: count.valueOf()-1, goal: goal, deadline: deadline,owner: owner.toString(), reached: 0, fundHide: false};
				console.log(o);
				$scope.projects.push(o);
				$scope.$apply();
				console.log($scope.projects);
				console.log("project added");
				return FundingHub.deployed().projects(count.valueOf()-1);
			}).then( function(pr){
				console.log("project:"+ pr);
			})
			;
	};


	$scope.$watch('projects',function(){
		projectListService.projects = $scope.projects;
	});

	$scope.contribute = function(id, amount) {
		console.log('amount:' + amount);
		console.log('funding project:' + id)
		console.log($scope.projects);
		FundingHub.deployed()
			.contribute(id,
				amount, {from: $scope.account, value: amount, gas:300000})
			.then(function (tx) {
				return web3.eth.getTransactionReceiptMined(tx);
			})
			.then(function (receipt) {
			$scope.projects[id].reached = Number($scope.projects[id].reached) +  amount;
			if ($scope.projects[id].reached >= Number($scope.projects[id].goal)) {
				$scope.projects[id].fundHide = true;
			}
				$scope.$apply();				
				console.log("project funded");
			});
	};

/*
	FundingHub.deployed().projects(5).then( function(pr){
		console.log(pr);
		return Project.at(pr).Funding({},{fromBlock: 0, toBlock: 'latest'});
	})
	.then(function (myEvent) {
		myEvent.watch(function(error,result){
	    	if (!error)
        		console.log(result);
		});
	});
*/



});
