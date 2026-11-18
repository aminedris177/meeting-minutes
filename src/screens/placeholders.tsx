// شاشات لسه فاضية — بتتملى في المراحل التالية.
import { EmptyState, Screen } from '../components/Screen';
import { t } from '../i18n';

export function MeetingsScreen() {
  const m = t().meetings;
  return (
    <Screen title={m.title}>
      <EmptyState text={m.empty} />
    </Screen>
  );
}

export function FollowupScreen() {
  const m = t().followup;
  return (
    <Screen title={m.title}>
      <EmptyState text={m.empty} />
    </Screen>
  );
}

export function ArchiveScreen() {
  const m = t().archive;
  return (
    <Screen title={m.title}>
      <EmptyState text={m.empty} />
    </Screen>
  );
}
