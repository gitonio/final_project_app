pragma solidity ^0.4.4;

import "Project.sol";


contract FundingHub {

    uint noof_projects;

    mapping (uint => Project) public projects;


	function FundingHub() {
		
	}

	function createProject(address receiver, uint goal, uint deadline, string project_name) returns(uint proposal_id) {  
		 projects[noof_projects] = new Project(receiver, goal, deadline, project_name, noof_projects);
		 noof_projects++;
	}

	function contribute(uint project, uint amount) public payable {
		Project(projects[project]).fund.value(msg.value)();

	}

	function count() returns (uint) {
		return noof_projects;
	}

}
