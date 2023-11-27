import React, { useCallback, useState } from "react";
import { Components, registerComponent } from "../../../lib/vulcan-lib";
import { AnalyticsContext } from "../../../lib/analyticsEvents";
import { votingPortalStyles } from "./styles";
import { isAdmin } from "../../../lib/vulcan-users";
import { useCurrentUser } from "../../common/withUser";
import { useNavigate } from "../../../lib/reactRouterWrapper";
import { useElectionVote } from "./hooks";

const styles = (theme: ThemeType) => ({
  ...votingPortalStyles(theme),
});

const EAVotingPortalSelectCandidatesPageLoader = ({ classes }: { classes: ClassesType }) => {
  const { electionVote, updateVote } = useElectionVote("givingSeason23");

  if (!electionVote) return null;

  return (
    <EAVotingPortalAllocateVotesPage
      electionVote={electionVote}
      updateVote={updateVote}
      classes={classes}
    />
  );
};

const EAVotingPortalAllocateVotesPage = ({
  electionVote,
  updateVote,
  classes,
}: {
  electionVote: Record<string, number | null>;
  updateVote: (newVote: Record<string, number | null>) => Promise<void>;
  classes: ClassesType;
}) => {
  const { VotingPortalFooter, ElectionAllocateVote } = Components;
  const navigate = useNavigate();
  const [voteState, setVoteState] = useState<Record<string, number | null>>(electionVote);

  const selectedCandidateIds = Object.keys(voteState);
  const allocatedCandidateIds = selectedCandidateIds.filter((id) => voteState[id] !== null);

  const saveAllocation = useCallback(async () => {
    await updateVote(voteState);
  }, [updateVote, voteState]);

  // TODO un-admin-gate when the voting portal is ready
  const currentUser = useCurrentUser();
  if (!isAdmin(currentUser)) return null;

  return (
    <AnalyticsContext pageContext="eaVotingPortalAllocateVotes">
      <div className={classes.root}>
        <div className={classes.content} id="top">
          <div className={classes.h2}>3. Allocate your votes</div>
          <div className={classes.subtitle}>
            Add numbers based on how you would allocate funding between these projects.{" "}
            <b>Don’t worry about the total vote count</b>, but make sure the relative vote counts are reasonable to you.
          </div>
          <ElectionAllocateVote
            voteState={voteState}
            setVoteState={setVoteState}
          />
        </div>
        <VotingPortalFooter
          leftHref="/voting-portal/compare"
          middleNode={<div>Allocated to {allocatedCandidateIds.length}/{selectedCandidateIds.length} projects</div>}
          buttonProps={{
            onClick: async () => {
              await saveAllocation();
              navigate({ pathname: "/voting-portal/submit" });
            },
            disabled: allocatedCandidateIds.length === 0,
          }}
        />
      </div>
    </AnalyticsContext>
  );
};

const EAVotingPortalAllocateVotesPageComponent = registerComponent(
  "EAVotingPortalAllocateVotesPage",
  EAVotingPortalSelectCandidatesPageLoader,
  {styles},
);

declare global {
  interface ComponentTypes {
    EAVotingPortalAllocateVotesPage: typeof EAVotingPortalAllocateVotesPageComponent;
  }
}

