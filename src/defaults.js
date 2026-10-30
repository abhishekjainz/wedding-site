// Default site content and settings, seeded into the database on first run and editable from the dashboard.
// Kept out of the public browser bundle so guest details are only served after the access check.
const DEFAULT_SETTINGS = {
  deadline: '2026-11-30T23:59:59+05:30',
  allowEditsAfterDeadline: false,
  adminOverrideOpen: false, // organizer can reopen RSVPs after the deadline
  helpPhone: '+919111888512',
  helpPhoneDisplay: '+91 91118 88512',
  mapsUrl: 'https://maps.app.goo.gl/vYhBvufxKBk5i5mL8',
  maxParty: 12,
  arrivalMin: '2027-02-03', arrivalMax: '2027-02-14',
  departureMin: '2027-02-09', departureMax: '2027-02-21',
  // Groups whose RSVP is just name, WhatsApp and who's coming (no event choice, travel or music).
  simpleGroups: [4],
  // Hosted stay at the hotel: from this date per group, until check-out at checkoutTime on stayUntil.
  stayFrom: { 1: '2027-02-12', 2: '2027-02-12', 3: '2027-02-13' },
  stayUntil: '2027-02-15', checkoutTime: '12:00',
  checkinTimes: { 1: '14:00', 2: '14:00', 3: '12:00' }, // first-day hotel check-in time per group
  roomOccupancy: 2, // planning estimate: guests per room (each party rounds up to whole rooms)
  countdownTo: '2027-02-14T13:00:00+05:30', // the countdown on every link counts down to this moment
  defaultLang: { 1: 'en', 2: 'hi', 3: 'hi', 4: 'en' }, // language each link opens in (guests can still switch)
  guideGroups: [1], // groups that see the travel guide for international guests
  funGroups: [1], // groups asked the drink & marriage-advice questions
  fullGroups: [2, 3], // RSVP 'yes' = every event the group is invited to; no event picker, no song request
  // Personal contacts for travel planning, shown in the travel guide (only after a guest opens their invitation).
  guideContacts: [
    { name: 'Dreamy', phone: '+917828643140', display: '+91 78286 43140' },
    { name: 'Abhishek', phone: '+6593830017', display: '+65 9383 0017' },
  ],
};

const DEFAULT_CONTENT = {
  coupleShort: { en: 'Dreamy & Abhishek', hi: 'ड्रीमी और अभिषेक' },
  dates: { en: '12 – 14 February 2027', hi: '12 – 14 फ़रवरी 2027' }, // fallback only; shown dates come from each group's events
  venueName: { en: 'Essentia Luxury Hotel', hi: 'एसेंशिया लग्ज़री होटल' },
  venueCity: { en: 'Indore, Madhya Pradesh, India', hi: 'इंदौर, मध्य प्रदेश, भारत' },
  welcome: {
    en: 'With the blessings of our families, we joyfully invite you to celebrate our wedding.',
    hi: 'अपने परिवारों के आशीर्वाद से, हम आपको अपने विवाह के उत्सव में सहर्ष आमंत्रित करते हैं।',
  },
  story: { // one line per verse (\n); shown as a short poem
    en: 'It started with our families, a formal hello, and a feeling we couldn’t quite explain.\nSomewhere between paint-stained hands and tennis courts, it became home.\nNow, we’d love for you to be there when it becomes forever.',
    hi: 'शुरुआत हमारे परिवारों से हुई — एक औपचारिक नमस्ते, और एक ऐसा एहसास जिसे हम शब्दों में बयान नहीं कर पाए।\nरंगों से सने हाथों और टेनिस कोर्ट के बीच कहीं, यह साथ घर बन गया।\nअब हम चाहते हैं कि जब यह हमेशा का बंधन बने, तब आप भी हमारे साथ हों।',
  },


  storyReviewNote: 'Hindi copy is a draft pending review.',
  photos: [ // Our Story: 1 large · 2 & 3 side by side · 4 optional wide. Captions are optional.
    { slot: 'hero', url: '', caption: { en: '', hi: '' } },
    { slot: 'a', url: '', caption: { en: '', hi: '' } },
    { slot: 'b', url: '', caption: { en: '', hi: '' } },
    { slot: 'wide', url: '', caption: { en: '', hi: '' } },
  ],
  // Our Story photos shown on the Close Family, Family & Guests and Other Guests links (Friends see `photos`).
  photosFamily: [
    { slot: 'hero', url: '', caption: { en: '', hi: '' } },
    { slot: 'a', url: '', caption: { en: '', hi: '' } },
    { slot: 'b', url: '', caption: { en: '', hi: '' } },
    { slot: 'wide', url: '', caption: { en: '', hi: '' } },
  ],
  heroImageUrl: '',  // couple's own photo for the welcome section
  venueImageUrl: '/assets/venue-photo.jpg', // Essentia Luxury Hotel Indore, photo supplied by the couple
};

// Source of truth for the itinerary AND RSVP eligibility.
// groups: 1 = Friends, 2 = Close Family, 3 = Family & Guests, 4 = Other Guests.
// An event with endDate spans several days: one card on the site, but guests pick the days they'll join.
// Suggested wardrobe. First line = the theme (shown on the event card); the rest appears in the event details.
const EVENT_DRESS = {
  'home-days': { en: 'Easy & comfortable\nLadies: kurta sets | casual Indian or western\nGentlemen: kurta | smart casual\nComfortable shoes for exploring Indore',
                 hi: 'आरामदायक और सहज\nमहिलाएँ: कुर्ता सेट | कैज़ुअल भारतीय या वेस्टर्न\nपुरुष: कुर्ता | स्मार्ट कैज़ुअल\nइंदौर घूमने के लिए आरामदायक जूते' },
  mehendi: { en: 'Shades of green\nLadies: chaniya choli | saree\nGentlemen: kurta pyjama', hi: 'हरे रंग के शेड्स\nमहिलाएँ: चनिया चोली | साड़ी\nपुरुष: कुर्ता पायजामा' },
  'bride-mayara': { en: 'Colourful Gujarati\nLadies: gharchola | bandhni | patola\nGentlemen: dhoti kurta', hi: 'रंग-बिरंगा गुजराती\nमहिलाएँ: घरचोला | बांधनी | पटोला\nपुरुष: धोती कुर्ता' },
  haldi: { en: 'Yellow | orange\nLadies: easy Indian attire\nGentlemen: easy Indian attire\nWear something you don’t mind getting a little yellow!', hi: 'पीला | नारंगी\nमहिलाएँ: हल्के-फुल्के भारतीय परिधान\nपुरुष: हल्के-फुल्के भारतीय परिधान\nऐसे कपड़े पहनें जिन पर थोड़ी हल्दी लग जाए तो चिंता न हो!' },
  'groom-mayara': { en: 'Colourful Gujarati\nLadies: gharchola | bandhni | patola\nGentlemen: dhoti kurta', hi: 'रंग-बिरंगा गुजराती\nमहिलाएँ: घरचोला | बांधनी | पटोला\nपुरुष: धोती कुर्ता' },
  reception: { en: 'Indian formals\nLadies: saree | lehenga\nGentlemen: jodhpuri | tuxedo', hi: 'भारतीय फ़ॉर्मल\nमहिलाएँ: साड़ी | लहंगा\nपुरुष: जोधपुरी | टक्सीडो' },
  baraat: { en: 'Pastels & safas\nLadies: lehenga | saree in pastel shades\nGentlemen: kurta | sherwani with a safa', hi: 'पेस्टल रंग और साफ़े\nमहिलाएँ: पेस्टल रंगों में लहंगा | साड़ी\nपुरुष: साफ़े के साथ कुर्ता | शेरवानी' },
  phere: { en: 'Traditional finery: jewel tones\nLadies: saree | lehenga\nGentlemen: sherwani | bandhgala', hi: 'पारंपरिक शान: गहरे, रत्न जैसे रंग\nमहिलाएँ: साड़ी | लहंगा\nपुरुष: शेरवानी | बंदगला' },
  'closing-dinner': { en: 'Glitz & glam\nLadies: indo-western\nGentlemen: indo-western', hi: 'चमक-दमक\nमहिलाएँ: इंडो-वेस्टर्न\nपुरुष: इंडो-वेस्टर्न' },
};
const EVENT_IMAGES = { haldi: '/assets/ev-haldi.jpg', mehendi: '/assets/ev-mehendi.jpg', reception: '/assets/ev-reception.jpg', baraat: '/assets/ev-baraat.jpg', phere: '/assets/ev-phere.jpg' };
// Colours for the dress-code illustration: [ladies' outfit, accent / dupatta, gentlemen's outfit, extra swatch…]
const EVENT_PALETTES = {
  'home-days': ['#e9c9b4', '#9fbfae', '#e8dccb', '#c98f74'],
  mehendi: ['#7a9a3a', '#c9d96b', '#a7c4a0', '#2f5d3a'],
  'bride-mayara': ['#c2185b', '#f2a900', '#7b3fa0', '#1f7a8c'],
  haldi: ['#f4c20d', '#f08a24', '#fbe3a0', '#fff1c7'],
  'groom-mayara': ['#c2185b', '#f2a900', '#7b3fa0', '#1f7a8c'],
  reception: ['#9b1b30', '#c9a14a', '#1f1f24', '#f2e6d0'],
  baraat: ['#f3c1cc', '#f8dfae', '#cfe4d8', '#c9d3ef'],
  phere: ['#8c1c3c', '#c9a14a', '#0f5e4f', '#1f3a7a'],
  'closing-dinner': ['#b9bcc6', '#d4af37', '#1c2541', '#6b3f7d'],
};
const EVENT_TITLES = {
  'bride-mayara': { en: 'Bride’s Maamera', hi: 'दुल्हन का मामेरा' },
  'groom-mayara': { en: 'Groom’s Mayra', hi: 'दूल्हे का मायरा' },
};
const HOME_DAYS_DESC = {
  en: 'Before the big crowds arrive, come early and settle in! These days are for getting to know each other’s friends, joining a few pre-wedding functions and celebrations, practising your performances for the wedding, picking up rental Indian outfits and, of course, exploring Indore (and its legendary street food). Come for one day or all three — the more, the merrier. We’ll help you book a hotel nearby for these nights, and the dates in your RSVP help us put everyone in the same hotel.',
  hi: 'शादी की भीड़ से पहले, जल्दी आइए और यहाँ रम जाइए! ये दिन एक-दूसरे के दोस्तों से घुलने-मिलने, शादी से पहले की कुछ रस्मों और जश्न में शामिल होने, शादी की परफ़ॉर्मेंस की तैयारी करने, किराये पर भारतीय परिधान लेने और हाँ, इंदौर (और यहाँ के मशहूर स्ट्रीट फ़ूड) की सैर के लिए हैं। एक दिन आइए या तीनों — जितने ज़्यादा, उतना मज़ा। इन रातों के लिए पास के होटल की बुकिंग में हम आपकी मदद करेंगे, और आपके आरएसवीपी की तारीख़ों से हम सबको एक ही होटल में ठहरा पाएँगे।',
};
// Friends-only late-night party straight after the Reception. It technically starts at 1 AM on 14 Feb,
// so `nightOf` keeps it under the 13 Feb tab and labels it "night of Sat 13 Feb".
const AFTERPARTY = {
  id: 'afterparty', sort: 5.5, date: '2027-02-14', nightOf: '2027-02-13', start: '01:00', end: '', groups: [1],
  endNote: { en: 'till late', hi: 'देर रात तक' },
  title: { en: 'The Afterparty', hi: 'आफ़्टर पार्टी' },
  desc: { en: 'The Reception wraps up… and the real party begins! 🎧 A DJ spinning till late, arcade games to settle old rivalries once and for all, and free-flowing drinks all night (alcoholic and non-alcoholic). Bring your dancing shoes and your competitive streak. Sleep is optional; Baraat-day energy is not!',
          hi: 'रिसेप्शन ख़त्म… और असली पार्टी शुरू! 🎧 देर रात तक DJ, पुरानी दुश्मनियाँ हमेशा के लिए निपटाने को आर्केड गेम्स, और पूरी रात फ़्री-फ़्लो ड्रिंक्स (अल्कोहलिक और नॉन-अल्कोहलिक)। अपने डांसिंग शूज़ और जीतने का जज़्बा साथ लाइए। नींद ज़रूरी नहीं — पर बारात वाले दिन की एनर्जी ज़रूरी है!' },
};
const EVENTS_VERSION = 5;
const EVENT_BASE = { endDate: '', timeNote: { en: '', hi: '' }, endNote: { en: '', hi: '' }, dress: { en: '', hi: '' }, imageUrl: '', palette: [], location: { en: '', hi: '' }, mapsUrl: '', reviewNote: 'Description pending family review', v: EVENTS_VERSION };
// Events saved by an older version get the newer defaults, but only where nothing has been customised.
function upgradeEvents(list) {
  // v5 adds the Friends' Afterparty (once: after the dashboard saves the events, they are all v5 and it is never re-added)
  if (list.some(e => (e.v || 1) < 5) && !list.some(e => e.id === 'afterparty')) list = [...list, { ...EVENT_BASE, ...AFTERPARTY }].sort((a, b) => a.sort - b.sort);
  return list.map(e => {
    const v = e.v || 1;
    if (v >= EVENTS_VERSION) return e;
    let x = { ...e, v: EVENTS_VERSION };
    if (v < 2) {
      const d = x.dress || {};
      x.dress = (d.en || d.hi) ? d : (EVENT_DRESS[x.id] || { en: '', hi: '' });
      x.imageUrl = x.imageUrl || EVENT_IMAGES[x.id] || '';
    }
    if (v < 3) {
      if (x.imageUrl === '/assets/ev-home-days.jpg') x.imageUrl = ''; // that photo is now Haldi's
      if (!x.imageUrl && (x.id === 'haldi' || x.id === 'baraat')) x.imageUrl = EVENT_IMAGES[x.id];
      if (!x.palette) x.palette = EVENT_PALETTES[x.id] || [];
      const oldTitle = { 'bride-mayara': 'Bride’s Mayara', 'groom-mayara': 'Groom’s Mayara' }[x.id];
      if (oldTitle && x.title && x.title.en === oldTitle) x.title = EVENT_TITLES[x.id];
    }
    if (v < 4) {
      // Dress codes are on hold for now ("will be added soon"); the suggestions stay in EVENT_DRESS for later.
      x.dress = { en: '', hi: '' }; x.palette = [];
      if (x.id === 'home-days') {
        if (x.desc && /^Before the big crowds arrive, come and be part of the family!/.test(x.desc.en || '')) x.desc = HOME_DAYS_DESC;
        if (x.timeNote && x.timeNote.en === 'Lunches, dinners & everything in between') x.timeNote = { en: 'New friends, pre-wedding fun & exploring Indore', hi: 'नए दोस्त, शादी से पहले की रौनक और इंदौर की सैर' };
      }
    }
    return x;
  });
}

const DEFAULT_EVENTS = [
  { id: 'home-days', sort: 0, date: '2027-02-09', endDate: '2027-02-11', start: '12:00', end: '', groups: [1],
    timeNote: { en: 'New friends, pre-wedding fun & exploring Indore', hi: 'नए दोस्त, शादी से पहले की रौनक और इंदौर की सैर' },
    title: { en: 'Pre-Wedding Home Days', hi: 'शादी से पहले, घर पर' },
    desc: HOME_DAYS_DESC,
    location: { en: 'At home & around Indore', hi: 'घर पर और इंदौर में' } },

  { id: 'mehendi', sort: 1, date: '2027-02-12', start: '16:00', end: '', groups: [1, 2],
    title: { en: 'Mehendi', hi: 'मेहंदी' },
    desc: { en: 'An afternoon of colour, music and celebration as intricate henna designs are applied to the bride’s hands — and to anyone who would like some.',
            hi: 'रंग, संगीत और उल्लास से भरी एक दोपहर, जब दुल्हन के हाथों पर सुंदर मेहंदी रचाई जाएगी — और जो भी चाहे, वह भी मेहंदी लगवा सकता है।' } },
  { id: 'bride-mayara', sort: 2, date: '2027-02-13', start: '11:00', end: '12:30', groups: [1, 2, 3],
    title: EVENT_TITLES['bride-mayara'],
    desc: { en: 'A cherished family tradition in which the bride’s maternal family arrives with gifts and blessings for her new beginning.',
            hi: 'एक प्रिय पारिवारिक परंपरा, जिसमें दुल्हन का ननिहाल उपहारों और आशीर्वाद के साथ उसके नए जीवन की शुभकामनाएँ देने आता है।' } },
  { id: 'haldi', sort: 3, date: '2027-02-13', start: '13:00', end: '16:00', groups: [1, 2, 3],
    title: { en: 'Haldi', hi: 'हल्दी' },
    desc: { en: 'A joyful ritual where family and friends apply turmeric paste to bless the couple with radiance and good fortune. Expect to get a little yellow!',
            hi: 'एक आनंदमय रस्म, जिसमें परिवार और मित्र जोड़े को हल्दी लगाकर सौभाग्य और निखार का आशीर्वाद देते हैं। थोड़ा पीला होने के लिए तैयार रहिए!' } },
  { id: 'groom-mayara', sort: 4, date: '2027-02-13', start: '16:30', end: '18:00', groups: [1, 2, 3],
    title: EVENT_TITLES['groom-mayara'],
    desc: { en: 'The groom’s maternal family honours him with gifts and blessings, in the same warm tradition.',
            hi: 'इसी स्नेहिल परंपरा में दूल्हे का ननिहाल उपहारों और आशीर्वाद से उसका सम्मान करता है।' } },
  { id: 'reception', sort: 5, date: '2027-02-13', start: '19:30', end: '', groups: [1, 2, 3, 4],
    title: { en: 'Reception', hi: 'रिसेप्शन' },
    desc: { en: 'An evening of dinner, music and dancing with everyone we love.',
            hi: 'अपने सभी प्रियजनों के साथ भोजन, संगीत और नृत्य से सजी एक शाम।' } },
  { id: 'baraat', sort: 6, date: '2027-02-14', start: '10:00', end: '12:00', groups: [1, 2, 3],
    title: { en: 'Baraat (Groom’s Procession)', hi: 'बारात' },
    desc: { en: 'The groom arrives in a lively procession with music and dancing, and is welcomed by the bride’s family. Join in and dance along!',
            hi: 'दूल्हा संगीत और नाच-गाने के साथ धूमधाम से बारात लेकर आता है और दुल्हन का परिवार उसका स्वागत करता है। आइए, साथ में झूमिए!' } },
  { id: 'phere', sort: 7, date: '2027-02-14', start: '13:00', end: '15:00', groups: [1, 2, 3],
    title: { en: 'Phere & Sajjan Goth', hi: 'फेरे और सज्जन गोठ' },
    desc: { en: 'The Phere is the sacred wedding ceremony, in which the couple take their vows in the presence of family and elders. It is followed by Sajjan Goth, a traditional meal shared by both families.',
            hi: 'फेरे विवाह का पवित्र संस्कार है, जिसमें परिवार और बड़ों की उपस्थिति में जोड़ा जीवन भर के वचन लेता है। इसके बाद सज्जन गोठ होगी — दोनों परिवारों का पारंपरिक सामूहिक भोज।' } },
  { id: 'closing-dinner', sort: 8, date: '2027-02-14', start: '19:00', end: '', groups: [1, 2, 3],
    title: { en: 'Closing Dinner', hi: 'समापन रात्रिभोज' },
    desc: { en: 'A relaxed final dinner together to round off the celebrations.',
            hi: 'उत्सव के समापन पर साथ मिलकर एक सुकून भरा रात्रिभोज।' } },
  AFTERPARTY,
].map(e => ({ ...EVENT_BASE, imageUrl: EVENT_IMAGES[e.id] || '', ...e }));


const Defaults = { DEFAULT_SETTINGS, DEFAULT_CONTENT, DEFAULT_EVENTS, upgradeEvents };
export default Defaults; // @@strip-for-browser
