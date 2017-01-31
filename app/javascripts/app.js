var app = angular.module('fundingHubApp', ['ngRoute']);
console.log('app');


app.config(function($routeProvider) {
  $routeProvider.when('/', {
    templateUrl: 'views/admin.html',
    controller: 'AdminController'
  })
  .when('/admin', {
    templateUrl: 'views/admin.html',
    controller: 'AdminController'
  })
  
  .otherwise({redirectTo: '/'});
});

app.service('projectListService',function($q, $timeout){
	accounts = web3.eth.accounts;
	console.log('web3');
	console.log(accounts);
	account = accounts[0];
	this.projects = [];
	initUtils(web3);
    var self = this;
	var project;

	this.collectProjects = function() {
		console.log('Collecting projects');
		FundingHub.deployed().count.call()
			.then(function (count) {
				console.log('Begin count');
				console.log('Count projects:'+count.valueOf());
				if (count.valueOf() > 0) {
					for (var i = 0; i < count.valueOf(); i++) {
								console.log("project:"+i);
								FundingHub.deployed().projects(i)
									.then(function (values) {
										console.log("Project address:"+values);
										project = Project.at(values);
										return project.proposal(0)
										.then( function(prop){
											console.log("owner address:"+prop[0]);
											console.log('1:'+prop[1].valueOf());
											console.log('2:'+prop[2].valueOf());
											console.log('3:'+prop[3].valueOf());
											console.log('4:'+prop[4].valueOf());
											console.log('5:'+prop[5].valueOf());
											console.log('6:'+prop[6].valueOf());
											console.log('hide:'+(prop[4].toNumber() >= prop[1].toNumber()));
											$timeout(function () {
												self.projects.push({
													owner: prop[0],
													goal: prop[1].valueOf(),
													deadline: prop[2].valueOf(),
													name: prop[7],
													id: prop[5].valueOf(),
													reached: prop[4].valueOf(),
													fundHide: (prop[4].toNumber() >= prop[1].toNumber())
												});
											});

										})
										
									})
									.catch(function (e) {
										console.error(e);
									});
							
					}
					
					
				}
				return $q.all(self.projects);
			});

	};

    this.collectProjects();

});


app.directive("adminProjects", function(){
	return {
		templateUrl: 'directives/adminprojects.html',
		replace: true,
		scope: {
			projectObject: "=",
			contributeFunction: "&"
		}
	}
});



