import { Boxes, CreditCard, UserPlus, Undo2 } from 'lucide-react';

export interface Template {
  id: string;
  name: string;
  summary: string;
  hasRollback: boolean;
  nodes: any[];
  edges: any[];
}

const n = (id: string, type: string, label: string, x: number, y: number, extra: object = {}) => ({
  id, type, position: { x, y }, data: { label, ...extra },
});
const e = (s: string, t: string, label?: string) => ({ id: `${s}-${t}`, source: s, target: t, label });

export const TEMPLATES: Template[] = [
  {
    id: 'order',
    name: 'Order processing',
    summary: 'Take payment, reserve stock, ship. If shipping fails, release stock and refund.',
    hasRollback: true,
    nodes: [
      n('start', 'START', 'Order placed', 0, 0),
      n('pay', 'HTTP', 'Capture payment', 240, 0, { compensation: { label: 'Refund payment' } }),
      n('inv', 'HTTP', 'Reserve inventory', 480, 0, { compensation: { label: 'Release inventory' } }),
      n('ship', 'HTTP', 'Create waybill', 720, 0),
      n('end', 'END', 'Order complete', 960, 0),
    ],
    edges: [e('start', 'pay'), e('pay', 'inv'), e('inv', 'ship'), e('ship', 'end')],
  },
  {
    id: 'onboarding',
    name: 'User onboarding',
    summary: 'Create the account, then branch on whether the email domain is a company.',
    hasRollback: true,
    nodes: [
      n('start', 'START', 'Signup', 0, 80),
      n('acct', 'HTTP', 'Create account', 240, 80, { compensation: { label: 'Delete account' } }),
      n('check', 'CONDITION', 'Company email?', 480, 80),
      n('ws', 'HTTP', 'Provision workspace', 720, 0, { compensation: { label: 'Remove workspace' } }),
      n('welcome', 'HTTP', 'Send welcome email', 720, 160),
      n('end', 'END', 'Done', 960, 80),
    ],
    edges: [
      e('start', 'acct'), e('acct', 'check'),
      e('check', 'ws', 'true'), e('check', 'welcome', 'false'),
      e('ws', 'end'), e('welcome', 'end'),
    ],
  },
  {
    id: 'refund',
    name: 'Refund request',
    summary: 'Validate the request, transform the payload, issue the refund, notify the customer.',
    hasRollback: false,
    nodes: [
      n('start', 'START', 'Refund requested', 0, 0),
      n('shape', 'TRANSFORM', 'Normalize payload', 240, 0),
      n('refund', 'HTTP', 'Issue refund', 480, 0),
      n('notify', 'HTTP', 'Notify customer', 720, 0),
      n('end', 'END', 'Closed', 960, 0),
    ],
    edges: [e('start', 'shape'), e('shape', 'refund'), e('refund', 'notify'), e('notify', 'end')],
  },
];

const ICON: Record<string, typeof Boxes> = { order: CreditCard, onboarding: UserPlus, refund: Undo2 };

export default function TemplatesGallery({
  onUse,
}: {
  onUse: (t: { name: string; nodes: any[]; edges: any[] }) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TEMPLATES.map((t) => {
        const Icon = ICON[t.id] ?? Boxes;
        return (
          <li
            key={t.id}
            className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <Icon className="h-5 w-5 text-sky-500" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</h3>
            <p className="mt-1 flex-1 text-sm text-slate-500 dark:text-slate-400">{t.summary}</p>
            <p className="mt-3 text-xs text-slate-400">
              {t.nodes.length} steps{t.hasRollback ? ' · includes rollback' : ''}
            </p>
            <button
              type="button"
              onClick={() => onUse({ name: t.name, nodes: t.nodes, edges: t.edges })}
              className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Use this template
            </button>
          </li>
        );
      })}
    </ul>
  );
}