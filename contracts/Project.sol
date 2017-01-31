pragma solidity ^0.4.4;



contract Project {

 
    struct Proposal  {
        address proposer;
        uint goal;
        uint deadline;
        uint start;
        uint reached;
        uint id;
        bool payout;
        string proposal_name;
        mapping (address => uint) contributions;
   }

    mapping (uint => Proposal) public proposal;

    address[] contributors;

    event Funding( string proposal_name);
    event logRefund( address contributor);


    function Project(address proposer, uint goal, uint deadline, string proposal_name, uint id) payable {
        proposal[0] = Proposal(proposer, goal, deadline, now,0, id, false, proposal_name); 
 	}


	function fund ( )  payable  returns(bool sufficient)  {
        proposal[0].contributions[tx.origin] += msg.value;
        contributors.push(tx.origin);
        proposal[0].reached += msg.value;
        if (proposal[0].reached >= proposal[0].goal) {
            payout();
        } 
        if (now > proposal[0].start + proposal[0].deadline) {
            refund();
        }
	}

	function payout() {
        proposal[0].payout = true;
        address toProposer = proposal[0].proposer;
        if ( 
            !toProposer.send( this.balance )
            ) throw;
        Funding(proposal[0].proposal_name);
	}

    function refund()  {
        if ( msg.sender == proposal[0].proposer) {
            for(uint x = 0; x < contributors.length; x++) {
                logRefund(contributors[x]);
                if (!contributors[x].send(proposal[0].contributions[contributors[x]])) {
                    throw;
                }
            }
            return;
        }
        
        if (proposal[0].contributions[msg.sender]>0){
            if (!msg.sender.send(proposal[0].contributions[msg.sender])) {
                throw;
            }        
            return;
        }
               
	}

 

}
