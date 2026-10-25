export interface Schedule {
  id: number;
  cronExpression: string;
  label: string;
  enabled: boolean;
  marketplace: string | null;
  createdAt: string;
}
