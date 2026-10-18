// Printable QR stickers: one per connector, with the charger ID printed for the tamper check (QR-06).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useApi } from '../../lib/hooks.js';
import { Loading } from '../../components/ui.jsx';
import { CONNECTOR_LABEL } from '../../driver/ChargerBits.jsx';
import { PageHeader } from '../Console.jsx';

function Sticker({ charger, connector, operator, support, size }) {
  const url = `${location.origin}/c/${encodeURIComponent(charger.ocppId)}/${connector.number}`;
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }).then(setSvg);
  }, [url]);
  return (
    <div className={`sticker flex flex-col items-center rounded-3xl border-4 border-brand-600 bg-white p-5 text-center text-ink-900 ${size === 'small' ? 'w-[70mm]' : 'w-[95mm]'}`} style={{ breakInside: 'avoid' }}>
      <div className="flex w-full items-center justify-between">
        <div className="text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">{operator}</div>
          <div className="text-lg font-extrabold leading-tight">Scan to charge</div>
        </div>
        <div className="rounded-xl bg-brand-600 px-3 py-1 text-xl font-black text-white">#{connector.number}</div>
      </div>
      <div className="mt-3 w-full rounded-2xl bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="mt-2 text-sm font-semibold">Pay by UPI · no app needed</div>
      <div className="text-xs text-ink-600">स्कैन करें, UPI से भुगतान करें, चार्ज करें</div>
      <div className="mt-3 w-full rounded-xl bg-ink-100 py-2">
        <div className="text-[10px] uppercase tracking-wider text-ink-500">Charger ID — must match your screen</div>
        <div className="font-mono text-xl font-bold">{charger.ocppId}</div>
        <div className="text-xs text-ink-600">{CONNECTOR_LABEL[connector.type] || connector.type} · {connector.maxPowerKw} kW {connector.powerType}</div>
      </div>
      <div className="mt-2 text-[10px] leading-snug text-ink-500">Only pay on the official page this QR opens. We never ask you to pay a personal UPI ID. If this sticker looks tampered, call {support}.</div>
    </div>
  );
}

export default function QrStickersPage() {
  const [sp] = useSearchParams();
  const ids = (sp.get('ids') || '').split(',').filter(Boolean);
  const { data } = useApi('/api/cms/chargers');
  const cfg = useApi('/api/public/config', { auth: 'none' });
  const [size, setSize] = useState('large');
  if (!data) return <Loading />;
  const chargers = data.chargers.filter((c) => !ids.length || ids.includes(c._id));
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="QR stickers" sub={`${chargers.reduce((n, c) => n + c.connectors.length, 0)} sticker(s) — print on weatherproof vinyl and fix next to each connector`}>
          <select className="input min-h-[36px] w-auto py-1 text-sm" value={size} onChange={(e) => setSize(e.target.value)}><option value="large">95 mm</option><option value="small">70 mm</option></select>
          <button type="button" className="btn-primary" onClick={() => window.print()}>Print</button>
        </PageHeader>
      </div>
      <div className="flex flex-wrap gap-6 print:gap-4">
        {chargers.flatMap((c) => c.connectors.map((x) => (
          <Sticker key={`${c._id}-${x.number}`} charger={c} connector={x} operator={c.tenant?.name || ''} support={cfg.data?.supportPhone || ''} size={size} />
        )))}
      </div>
    </>
  );
}
