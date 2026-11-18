import { t } from '../i18n';
import { ArchiveIcon, FollowupIcon, HomeIcon, MeetingsIcon, SettingsIcon } from './icons';

const items = [
  { seg: '', href: '#/', Icon: HomeIcon, label: () => t().nav.home },
  { seg: 'meetings', href: '#/meetings', Icon: MeetingsIcon, label: () => t().nav.meetings },
  { seg: 'followup', href: '#/followup', Icon: FollowupIcon, label: () => t().nav.followup },
  { seg: 'archive', href: '#/archive', Icon: ArchiveIcon, label: () => t().nav.archive },
  { seg: 'settings', href: '#/settings', Icon: SettingsIcon, label: () => t().nav.settings },
];

export function BottomNav({ active }: { active: string }) {
  return (
    <nav class="bottom-nav">
      {items.map(({ seg, href, Icon, label }) => (
        <a key={seg} href={href} class={active === seg ? 'active' : ''} aria-current={active === seg ? 'page' : undefined}>
          <Icon />
          <span>{label()}</span>
        </a>
      ))}
    </nav>
  );
}
