import { Select } from '../components/ui/Select';
import { useProject } from './projectContext';

const ALL = '__all__';

export function TeamSelect({ className }: { className?: string }) {
  const { teams, teamId, setTeamId, teamsLoading } = useProject();
  return (
    <Select
      label="Team"
      hideLabel
      className={className}
      value={teamId ?? ALL}
      disabled={teamsLoading}
      onChange={(v) => setTeamId(v === ALL ? undefined : v)}
      options={[
        { value: ALL, label: 'All teams' },
        ...teams.map((t) => ({ value: t.id, label: t.name })),
      ]}
    />
  );
}
