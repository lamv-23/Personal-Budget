"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  label: string;
  income: number;
  expense: number;
  savings: number;
}

interface OverviewChartProps {
  data: DataPoint[];
}

const formatK = (value: number) => {
  if (Math.abs(value) >= 100000) return `$${(value / 100000).toFixed(0)}k`;
  if (Math.abs(value) >= 1000) return `$${(value / 100000).toFixed(1)}k`;
  return `$${(value / 100).toFixed(0)}`;
};

const tooltipFormatter = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value / 100);

export function OverviewChart({ data }: OverviewChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [tooltipFormatter(value as number), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            fontSize: "12px",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Bar dataKey="income" name="income" fill="#16a34a" radius={[2, 2, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={24} />
        <Bar dataKey="savings" name="savings" fill="#2563eb" radius={[2, 2, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
