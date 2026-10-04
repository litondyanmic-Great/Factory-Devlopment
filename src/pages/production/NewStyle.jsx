import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ImagePlus } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Field, inputClass, btnPrimary, btnSecondary } from '../../components/ui';
import { emptyStageMap } from '../../lib/constants';
import { useLang } from '../../lib/i18n';
import { fileToCompressedDataUrl } from '../../lib/imageUtils';
import PoColourEditor, { emptyPo, posSummary } from '../../components/PoColourEditor';
import { getLocalStyles, saveLocalStyles } from '../../lib/demoData';

export default function NewStyle() {
  const { user, profile } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    orderDate: new Date().toISOString().slice(0, 10),
    buyer: '',
    styleName: '',
    styleNo: '',
    orderQty: '',
    colour: '',
    poNo: '',
    gg: '',
    shipDate: '',
    yarnComposition: '',
    notes: '',
  });
  const [pos, setPos] = useState([emptyPo()]);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 700, 0.75);
      setImageDataUrl(dataUrl);
    } catch {
      setError(t('ছবি আপলোড করা যায়নি।', 'Could not upload image.'));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!form.styleNo.trim() || !form.buyer.trim()) {
      setError(t('বায়ার এবং স্টাইল নম্বর আবশ্যক।', 'Buyer and Style Number are required.'));
      return;
    }

    // Process POs
    let cleanPos = pos
      .map((po) => ({
        poNo: (po.poNo || '').trim(),
        colours: (po.colours || [])
          .map((c) => ({ colour: (c.colour || '').trim(), qty: Number(c.qty) || 0 }))
          .filter((c) => c.colour && c.qty > 0),
      }))
      .filter((po) => po.poNo && po.colours.length > 0);

    let summary = posSummary(cleanPos);
    let totalQty = summary.orderQty;

    // Fallback if user filled direct Order Qty field instead of multi-PO
    const directQty = Number(form.orderQty) || 0;
    if (totalQty <= 0 && directQty > 0) {
      totalQty = directQty;
      const defaultPoNo = form.poNo.trim() || `PO-${form.styleNo.replace(/[^a-zA-Z0-9]/g, '')}`;
      const defaultCol = form.colour.trim() || 'Standard';
      cleanPos = [{ poNo: defaultPoNo, colours: [{ colour: defaultCol, qty: directQty }] }];
      summary = { poNo: defaultPoNo, colour: defaultCol, orderQty: directQty };
    }

    if (totalQty <= 0) {
      setError(
        t(
          'অর্ডার কোয়ান্টিটি দিন (সরাসরি কোয়ান্টিটি ফিল্ডে অথবা PO ও কালার-ওয়াইজ বক্সে)।',
          'Please enter Order Quantity (either in the Order Quantity field or via PO & Colour rows).'
        )
      );
      return;
    }

    setBusy(true);

    const generatedId = `style-${Date.now()}`;
    const newStyleData = {
      id: generatedId,
      orderDate: form.orderDate || null,
      buyer: form.buyer.trim(),
      pos: cleanPos,
      poNo: summary.poNo || form.poNo.trim() || '',
      styleName: form.styleName.trim() || '',
      styleNo: form.styleNo.trim(),
      gg: form.gg.trim() || '',
      shipDate: form.shipDate || null,
      colour: summary.colour || form.colour.trim() || '',
      yarnComposition: form.yarnComposition.trim() || '',
      orderQty: totalQty,
      notes: form.notes || '',
      imageUrl: imageDataUrl || '',
      stages: emptyStageMap(0),
      productionStarted: false,
      createdAt: new Date().toISOString(),
      createdBy: profile?.name || user?.displayName || user?.email || 'Admin',
    };

    try {
      let finalId = generatedId;
      try {
        const docRef = await addDoc(collection(db, 'styles'), {
          ...newStyleData,
          createdAt: serverTimestamp(),
        });
        finalId = docRef.id;
      } catch (err) {
        console.warn('Firestore addDoc fallback:', err);
      }

      // Save to local styles cache
      const currentList = getLocalStyles();
      saveLocalStyles([{ ...newStyleData, id: finalId }, ...currentList]);

      setSuccessMsg(t('স্টাইল সফলভাবে তৈরি ও সংরক্ষিত হয়েছে!', 'Style created and saved successfully!'));
      setTimeout(() => {
        navigate(`/production/${finalId}`);
      }, 700);
    } catch (err) {
      console.error('Create style error:', err);
      setError(t('স্টাইল তৈরি করা যায়নি, আবার চেষ্টা করুন।', 'Could not create style, please try again.'));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{t('নতুন স্টাইল', 'New Style')}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t('নতুন অর্ডার/স্টাইলের তথ্য দিন।', 'Enter the new order / style details.')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-line bg-surface p-6">
        <div>
          <span className="mb-2 block text-sm font-medium text-ink">{t('স্টাইলের ছবি', 'Style photo')}</span>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper">
              {imageDataUrl ? (
                <img src={imageDataUrl} alt="style" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus size={22} className="text-ink-soft" />
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-paper">
              {t('ছবি আপলোড করুন', 'Upload photo')}
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('তারিখ', 'Date')}>
            <input
              type="date"
              className={inputClass}
              value={form.orderDate}
              onChange={(e) => update('orderDate', e.target.value)}
            />
          </Field>
          <Field label={t('বায়ার *', 'Buyer *')}>
            <input className={inputClass} value={form.buyer} onChange={(e) => update('buyer', e.target.value)} />
          </Field>
          <Field label={t('স্টাইল নাম', 'Style Name')}>
            <input
              className={inputClass}
              value={form.styleName}
              onChange={(e) => update('styleName', e.target.value)}
            />
          </Field>
          <Field label={t('স্টাইল নম্বর *', 'Style Number *')}>
            <input className={inputClass} value={form.styleNo} onChange={(e) => update('styleNo', e.target.value)} />
          </Field>
          <Field label="GG">
            <input className={inputClass} value={form.gg} onChange={(e) => update('gg', e.target.value)} />
          </Field>
          <Field label={t('শিপমেন্ট ডেট', 'Shipment Date')}>
            <input
              type="date"
              className={inputClass}
              value={form.shipDate}
              onChange={(e) => update('shipDate', e.target.value)}
            />
          </Field>
          <Field label={t('মোট অর্ডার কোয়ান্টিটি (পিস)', 'Total Order Quantity (Pcs)')}>
            <input
              type="number"
              min="1"
              placeholder="e.g. 5000"
              className={inputClass}
              value={form.orderQty}
              onChange={(e) => update('orderQty', e.target.value)}
            />
          </Field>
          <Field label={t('মূল রঙ (যদি থাকে)', 'Primary Colour (Optional)')}>
            <input
              placeholder="e.g. Navy Blue / Black"
              className={inputClass}
              value={form.colour}
              onChange={(e) => update('colour', e.target.value)}
            />
          </Field>
          <Field label={t('ইয়ার্ন কম্পোজিশন', 'Yarn Composition')}>
            <input
              className={inputClass}
              placeholder={t('যেমন: ৭০% অ্যাক্রিলিক ৩০% উল', 'e.g. 70% Acrylic 30% Wool')}
              value={form.yarnComposition}
              onChange={(e) => update('yarnComposition', e.target.value)}
            />
          </Field>
        </div>

        <PoColourEditor pos={pos} onChange={setPos} />

        <Field label={t('নোট', 'Notes')}>
          <textarea
            className={inputClass}
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </Field>

        {error && <p className="text-sm font-medium text-red bg-red-soft/30 p-2.5 rounded-lg border border-red/20">{error}</p>}
        {successMsg && (
          <p className="text-sm font-medium text-green bg-green/10 p-2.5 rounded-lg border border-green/30 flex items-center gap-2">
            <span>✓</span> {successMsg}
          </p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? t('সংরক্ষণ হচ্ছে…', 'Saving…') : t('স্টাইল তৈরি করুন', 'Create Style')}
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate(-1)}>
            {t('বাতিল', 'Cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
