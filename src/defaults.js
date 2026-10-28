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
  heroImageUrl: '',  // couple's own photo for the welcome section
  venueImageUrl: '/assets/venue-photo.jpg', // Essentia Luxury Hotel Indore, photo supplied by the couple
};

// Source of truth for the itinerary AND RSVP eligibility.
// groups: 1 = Friends, 2 = Close Family, 3 = Family & Guests, 4 = Other Guests.
// An event with endDate spans several days: one card on the site, but guests pick the days they'll join.
const DEFAULT_EVENTS = [
  { id: 'home-days', sort: 0, date: '2027-02-09', endDate: '2027-02-11', start: '12:00', end: '', groups: [1],
    timeNote: { en: 'Lunches, dinners & everything in between', hi: 'दोपहर-रात का खाना और ढेर सारी मस्ती' },
    title: { en: 'Pre-Wedding Home Days', hi: 'शादी से पहले, घर पर' },
    desc: { en: 'Before the big crowds arrive, come and be part of the family! Three easy, unhurried days of long home-cooked lunches and lively dinners, exploring Indore (and its legendary street food), outfit try-ons where honest opinions are very welcome, and getting to know the friends and family who mean the world to us. Come for one day or all three — the more, the merrier.',
            hi: 'मेहमानों की भीड़ आने से पहले, आइए परिवार का हिस्सा बनिए! तीन सुकून भरे दिन — घर के बने लंबे लंच और रौनक भरे डिनर, इंदौर की सैर (और यहाँ का मशहूर स्ट्रीट फ़ूड), कपड़ों की ट्रायल जहाँ आपकी बेबाक राय का पूरा स्वागत है, और उन दोस्तों व परिवार से मिलना जो हमारे लिए सबसे ख़ास हैं। एक दिन आइए या तीनों — जितने ज़्यादा, उतना मज़ा।' },
    location: { en: 'At home & around Indore', hi: 'घर पर और इंदौर में' } },

  { id: 'mehendi', sort: 1, date: '2027-02-12', start: '16:00', end: '', groups: [1, 2],
    title: { en: 'Mehendi', hi: 'मेहंदी' },
    desc: { en: 'An afternoon of colour, music and celebration as intricate henna designs are applied to the bride’s hands — and to anyone who would like some.',
            hi: 'रंग, संगीत और उल्लास से भरी एक दोपहर, जब दुल्हन के हाथों पर सुंदर मेहंदी रचाई जाएगी — और जो भी चाहे, वह भी मेहंदी लगवा सकता है।' } },
  { id: 'bride-mayara', sort: 2, date: '2027-02-13', start: '11:00', end: '12:30', groups: [1, 2, 3],
    title: { en: 'Bride’s Mayara', hi: 'दुल्हन का मायरा' },
    desc: { en: 'A cherished family tradition in which the bride’s maternal family arrives with gifts and blessings for her new beginning.',
            hi: 'एक प्रिय पारिवारिक परंपरा, जिसमें दुल्हन का ननिहाल उपहारों और आशीर्वाद के साथ उसके नए जीवन की शुभकामनाएँ देने आता है।' } },
  { id: 'haldi', sort: 3, date: '2027-02-13', start: '13:00', end: '16:00', groups: [1, 2, 3],
    title: { en: 'Haldi', hi: 'हल्दी' },
    desc: { en: 'A joyful ritual where family and friends apply turmeric paste to bless the couple with radiance and good fortune. Expect to get a little yellow!',
            hi: 'एक आनंदमय रस्म, जिसमें परिवार और मित्र जोड़े को हल्दी लगाकर सौभाग्य और निखार का आशीर्वाद देते हैं। थोड़ा पीला होने के लिए तैयार रहिए!' } },
  { id: 'groom-mayara', sort: 4, date: '2027-02-13', start: '16:30', end: '18:00', groups: [1, 2, 3],
    title: { en: 'Groom’s Mayara', hi: 'दूल्हे का मायरा' },
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
].map(e => ({ endDate: '', timeNote: { en: '', hi: '' }, dress: { en: '', hi: '' }, location: { en: '', hi: '' }, mapsUrl: '', reviewNote: 'Description pending family review', ...e }));

const Defaults = { DEFAULT_SETTINGS, DEFAULT_CONTENT, DEFAULT_EVENTS };
export default Defaults; // @@strip-for-browser
