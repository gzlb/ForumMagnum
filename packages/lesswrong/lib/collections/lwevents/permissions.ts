import { userOwns, userGroups, userCanDo } from '../../vulcan-users/permissions';
import LWevents from './collection';

const membersActions = [
  'events.new.own',
  'events.view.own',
];
userGroups.members.can(membersActions);

const adminActions = [
  'events.new',
  'events.edit.all',
  'events.remove.all',
  'events.view.all',
];
userGroups.admins.can(adminActions);

LWevents.checkAccess = async (user: DbUser|null, document: DbLWEvent, context: ResolverContext|null): Promise<boolean> => {
  if (!user || !document) return false;
  if (document.name === "gatherTownUsersCheck") return true
  return userOwns(user, document) ? userCanDo(user, 'events.view.own') : userCanDo(user, `events.view.all`)
};
