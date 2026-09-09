// src/components/HomeIntelligencePanel.jsx

import { useHome } from '../context/HomeContext';
import { getSignals } from '../utils/signalLayer';
import { signalsToContext } from '../utils/contextLayer';
import Icon from './ui/Icon';
import { Card, StatTile, cx } from './ui/primitives';

/**
 * Premium dashboard component showing high‑level AI state.
 */
export default function HomeIntelligencePanel() {
  const { state } = useHome();
  const signals = getSignals(state);
  const context = signalsToContext(signals);

  const activeInsights = state.insights?.filter((i) => i.severity !== 'success')?.length || 0;
  const highPriority = state.insights?.filter((i) => i.tier === 'CRITICAL' || i.tier === 'HIGH')?.length || 0;

  // Placeholder potential savings – derived from eco score utilities
  const potentialSavings = 0; // TODO: compute from savingsOpportunities(state)

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="Sparkles" size={16} className="text-violet-300" />
        <h2 className="text-lg font-semibold text-mist-100">HOME SENSE INTELLIGENCE</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 text-mist-200 text-sm">
        <div>
          <p className="font-medium">Current state</p>
          <p className="mt-1">🟢 Home understood</p>
        </div>
        <div>
          <p className="font-medium">Signals analyzed</p>
          <p className="mt-1">{signals.length}</p>
        </div>
        <div>
          <p className="font-medium">Active insights</p>
          <p className="mt-1">{activeInsights}</p>
        </div>
        <div>
          <p className="font-medium">High‑priority issues</p>
          <p className="mt-1">{highPriority}</p>
        </div>
        <div className="col-span-2">
          <p className="font-medium">Potential savings today</p>
          <p className="mt-1">₹{potentialSavings}</p>
        </div>
      </div>
    </Card>
  );
}

