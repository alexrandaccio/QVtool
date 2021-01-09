import React, { useState, useEffect, useReducer, useContext } from "react";
import { useParams } from "react-router-dom";
import moment from 'moment';
import { ProcessPageRouteParams } from "../../../../models/ProcessPageRouteParams";
import { Proposal } from "../../../../models/Proposal";
import { getElection, getId, standInElection } from "../../../../utils";
import { WebService } from "../../../../services";
import { Vote } from "../../../../models/Vote";
import ProposalWidget from "./components/ProposalWidget";
import { ActionContext, StateContext } from "../../../../hooks";

import "./Election.scss";
import { BgColor } from "../../../../models/BgColor";
import ProposalResults from "./components/ProposalResults";

function Election() {
  const [votesCast, setVotesCast] = useState(0);

  function voteReducer(votes: Vote[], change: any) {
    const voteToChange: Vote | undefined = votes.find(
      vote => vote.proposal === change.proposal);
    if (voteToChange === undefined) {
      const newVote: Vote = { id: 0,
                              sender: '',
                              proposal: change.proposal,
                              amount: change.amount,
                              date: '',
                            };
      setVotesCast(votesCast + Math.abs(change.amount));
      return [...votes, newVote];
    } else {
      setVotesCast(votesCast - Math.abs(voteToChange.amount) + Math.abs(voteToChange.amount + change.amount));
      voteToChange.amount = voteToChange.amount + change.amount;
      return votes;
    }
  };

  const initCredits: number = 0;
  const { processId } = useParams<ProcessPageRouteParams>();
  const [election, setElection] = useState(standInElection);
  const [creditsRemaining, setCreditsRemaining] = useState(initCredits);
  const [proposals, setProposals] = useState(new Array<Proposal>());
  const [votes, voteDispatch] = useReducer(voteReducer, new Array<Vote>());
  const [viewResults, setViewResults] = useState(false);
  const { selectedProcess } = useContext(StateContext);
  const { selectProcess, setColor } = useContext(ActionContext);

  useEffect(() => {
    setColor(BgColor.White);
    if (processId && (!selectedProcess || (getId(selectedProcess) !== +processId))) {
      selectProcess(processId);
    } else if (selectedProcess) {
      const thisElection = getElection(selectedProcess);
      if (thisElection) {
        if (election.id !== thisElection.id) {
          setElection(election => thisElection!);
          if (thisElection.show_results) {
            setViewResults(true);
          } else {
            setCreditsRemaining(WebService.userobj.credit_balance);
          }
          WebService.fetchProposals(thisElection.id)
          .subscribe((data: Proposal[]) => {
            data.sort((a: Proposal, b: Proposal) => {
              return Number(b.votes_received) - Number(a.votes_received);
            })
            setProposals(proposals => data);
            data.forEach(proposal => {
              voteDispatch({ proposal: proposal.id, amount: 0, });
            });
          });
        }
      }
    }

   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [processId, selectedProcess]);

  const onChangeVoteCount = (change: any) => {
    setCreditsRemaining(creditsRemaining =>
      Number(creditsRemaining) - Number(change.cost));
    voteDispatch({ proposal: change.proposal, amount: change.amount, });
  };

  const submitVotes = () => {
    const postData = new Array<any>();
    const user = sessionStorage.getItem("user");
    votes.forEach(vote => postData.push({
      proposal: vote.proposal,
      amount: vote.amount,
      date: moment().format('YYYY-MM-DDTHH:MM'),
      sender: user ? JSON.parse(user).id : '',
    }));
    WebService.postVotes(postData, election.id).subscribe(async (data) => {
                    if (data.ok) {
                      setViewResults(true);
                    } else {
                      const error = await data.json();
                      Object.keys(error).forEach((key) => {
                        console.log(error[key]);
                      });
                    }
                  });
  };

  if (moment() < moment(election.start_date)) {
    return (
      <div className="voting-page">
        <div className="sticky-header">
          <h2 className="content-header">Election</h2>
          <p>This election begins {moment(election.start_date, "YYYYMMDD").fromNow()}</p>
        </div>
      </div>
    );
  } else if (moment() > moment(election.end_date)) {
    return (
      <div className="voting-page">
        <div className="sticky-header">
          <h2 className="content-header">Election Results</h2>
        </div>
        <ol>
          {proposals.map((proposal: Proposal, i) => (
            <ProposalResults key={i} proposal={proposal} />
          ))}
        </ol>
      </div>
    );
  } else if (viewResults === true) {
    return (
      <div className="voting-page">
        <div className="sticky-header">
          <h2 className="content-header">Election</h2>
          <p className="already-voted">Thanks for voting! The results will
            appear here when the election stage is over.
          </p>
        </div>
      </div>
    );
  } else {
    return (
        <div className="voting-page">
          <div className="sticky-header">
            <h2 className="content-header">Election</h2>
            <div className="available-credits-widget">
              <h3 className="available-credits-text">Available Voice Credits</h3>
              <p className="credits-remaining">
                {creditsRemaining}/{WebService.userobj.credit_balance} voice credits remaining
              </p>
            </div>
          </div>
          <hr />
          <ul>
            {proposals.map((proposal: Proposal, i) => (
              <ProposalWidget key={i}
                              creditsRemaining={creditsRemaining}
                              proposal={proposal}
                              negativeVotes={election.negative_votes}
                              onChange={onChangeVoteCount} />
            ))}
          </ul>
          <div className="button-container">
            <label className="votes-cast">total votes cast: {votesCast}</label>
            <button
              type="button"
              className="submit-button"
              onClick={() => submitVotes()}
              >
              submit votes
            </button>
          </div>
        </div>
    );
  }
}

export default Election;
