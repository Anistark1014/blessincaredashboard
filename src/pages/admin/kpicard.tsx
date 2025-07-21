// components/KpiCard.tsx
import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  color?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, color = 'bg-gray-100' }) => {
  return (
    <div className={`rounded-xl p-4 shadow-md ${color}`}>
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-semibold text-gray-800">{value}</div>
    </div>
  );
};

export default KpiCard;
