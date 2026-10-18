import { createContext, useContext, useMemo, useState } from 'react';
import { store } from './api.js';

// All driver-facing strings are externalised; English + Hindi at launch (UX 1.5).
const STRINGS = {
  en: {
    appName: 'ChargeX', find: 'Find', history: 'History', account: 'Account', login: 'Log in', logout: 'Log out',
    searchPlaceholder: 'Search area, mall or city', availableNow: 'Available now', allChargers: 'Show all',
    directions: 'Directions', startCharging: 'Start charging', chooseAmount: 'Choose an amount', custom: 'Custom',
    phoneForReceipt: 'Phone number (for receipt and session link)', payUpi: 'Pay with UPI', prepaidNote: 'prepaid, unused amount refunded automatically',
    lastCharged: 'Last successful charge', uptime: 'Uptime', notWorking: 'Not working', offline: 'Offline',
    stop: 'Stop charging', stopConfirm: 'Stop charging now?', reportProblem: 'Report a problem', chargeAgain: 'Charge again',
    elapsed: 'Elapsed', energy: 'Energy', cost: 'Cost', power: 'Power', battery: 'Battery', invoice: 'Invoice', rate: 'Rate this charge',
    refund: 'Refund', total: 'Total', unplug: 'Please unplug and free the spot.', installApp: 'Get the app for history and one-tap payments',
    otpSent: 'We sent a 6-digit code to', verify: 'Verify', sendCode: 'Send code', resend: 'Resend code', tryAnother: 'Try another connector',
    steps: ['Payment received', 'Charger contacted', 'Waiting for car', 'Charging'], offlineBanner: 'Offline — status may be old',
    noChargers: 'No chargers nearby', widen: 'Widen search', howToReach: 'How to reach', price: 'Price', perKwh: '/kWh', sessionFee: 'session fee',
  },
  hi: {
    appName: 'ChargeX', find: 'खोजें', history: 'इतिहास', account: 'खाता', login: 'लॉग इन', logout: 'लॉग आउट',
    searchPlaceholder: 'इलाका, मॉल या शहर खोजें', availableNow: 'अभी उपलब्ध', allChargers: 'सभी दिखाएँ',
    directions: 'रास्ता', startCharging: 'चार्जिंग शुरू करें', chooseAmount: 'राशि चुनें', custom: 'अपनी राशि',
    phoneForReceipt: 'फ़ोन नंबर (रसीद और लिंक के लिए)', payUpi: 'UPI से भुगतान करें', prepaidNote: 'अग्रिम, बची राशि अपने-आप वापस',
    lastCharged: 'आखिरी सफल चार्ज', uptime: 'अपटाइम', notWorking: 'काम नहीं कर रहा', offline: 'ऑफ़लाइन',
    stop: 'चार्जिंग रोकें', stopConfirm: 'क्या चार्जिंग अभी रोकें?', reportProblem: 'समस्या बताएँ', chargeAgain: 'फिर से चार्ज करें',
    elapsed: 'समय', energy: 'ऊर्जा', cost: 'लागत', power: 'पावर', battery: 'बैटरी', invoice: 'चालान', rate: 'रेटिंग दें',
    refund: 'रिफंड', total: 'कुल', unplug: 'कृपया केबल निकालें और जगह खाली करें।', installApp: 'इतिहास और एक-टैप भुगतान के लिए ऐप लें',
    otpSent: 'हमने 6 अंकों का कोड भेजा', verify: 'सत्यापित करें', sendCode: 'कोड भेजें', resend: 'कोड दोबारा भेजें', tryAnother: 'दूसरा कनेक्टर आज़माएँ',
    steps: ['भुगतान मिला', 'चार्जर से संपर्क', 'गाड़ी का इंतज़ार', 'चार्जिंग'], offlineBanner: 'ऑफ़लाइन — स्थिति पुरानी हो सकती है',
    noChargers: 'पास में कोई चार्जर नहीं', widen: 'दायरा बढ़ाएँ', howToReach: 'कैसे पहुँचें', price: 'कीमत', perKwh: '/kWh', sessionFee: 'सत्र शुल्क',
  },
};

const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(store.get('cx.lang') || 'en');
  const value = useMemo(() => ({
    lang,
    setLang: (l) => {
      store.set('cx.lang', l);
      setLangState(l);
      document.documentElement.lang = l;
    },
    t: (k) => STRINGS[lang]?.[k] ?? STRINGS.en[k] ?? k,
  }), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
