/**
 * i18n.js — Internationalization for MemoAI
 * Languages: English (en), Hindi (hi), Marathi (mr)
 */

const translations = {
  en: {
    // Tabs
    tabChat:      'Chat',
    tabMemories:  'Memories',
    tabPeople:    'People',
    tabAdd:       'Add',
    tabSettings:  'Settings',

    // Chat
    chatGreeting:    "Hello! I'm MemoAI, your memory companion. How are you feeling today?",
    chatPlaceholder: 'Type a message...',
    chatThinking:    'Thinking...',
    chatError:       "I'm sorry, I had trouble understanding. Could you try again?",

    // Memories
    memSearchPlaceholder: 'Search memories...',
    memFetching:          'Loading memories...',
    memEmpty:             'No memories yet',
    memEmptyBody:         'Add a memory by typing, recording, or uploading a photo.',
    memModalTitle:        'Upload a Photo Memory',
    memGallery:           '📷 Gallery',
    memCamera:            '📸 Camera',
    memCaregiverNote:     'Caregiver note (optional)',
    memNotePlaceholder:   'e.g. "Priya at Diwali 2019"',
    memAnalyse:           'Save & Analyse Photo',
    memSaved:             'Memory Saved!',
    memPeopleFound:       'people identified',
    memPerson:            'person identified',
    memDone:              'Done',

    // People
    peopleSearch:    'Search by name or relation...',
    peopleLoading:   'Loading people...',
    peopleEmpty:     'No people added yet',
    peopleEmptyBody: 'Upload a photo or add a memory mentioning a family member.',
    peopleAddMemory: 'Add a Memory',
    ageLabel:        'Age:',

    // Add Memory
    addTitle:        'Add a Memory',
    addPlaceholder:  'Write a memory, event, or important note...',
    addTypeNote:     'Note',
    addTypeEvent:    'Event',
    addTypePerson:   'Person',
    addTypePlace:    'Place',
    addSubmit:       'Save Memory',
    addSuccess:      'Memory saved!',

    // Settings
    settingsLanguage:   'Language',
    settingsBackend:    'Backend URL',
    settingsPatient:    'Patient ID',
    settingsSave:       'Save Settings',
    settingsSaved:      'Saved!',
    settingsAbout:      'About MemoAI',
    settingsAboutBody:  'MemoAI is a voice-first memory companion for Alzheimer\'s patients. All conversations are private and stored locally.',
    settingsDashboard:  'Caregiver Dashboard',

    // Dashboard
    dashTitle:       'Caregiver Dashboard',
    dashHealth:      'System Health',
    dashOnline:      'Backend online',
    dashOffline:     'Backend offline',
    dashAlerts:      'Cognitive Monitoring',
    dashAnomalyScore:'Wellbeing Score',
    dashAnomalyFlags:'Detected Flags',
    dashNoAlerts:    'No concerns detected',
    dashCheck:       'Run Anomaly Check',
    dashRecentLogs:  'Recent Interactions',
    dashRefresh:     'Refresh',
    dashDataExport:  'Export Training Data',
    dashStats:       'Session Statistics',
  },

  hi: {
    tabChat:      'बात करें',
    tabMemories:  'यादें',
    tabPeople:    'लोग',
    tabAdd:       'जोड़ें',
    tabSettings:  'सेटिंग्स',

    chatGreeting:    'नमस्ते! मैं MemoAI हूँ, आपका स्मृति साथी। आज आप कैसा महसूस कर रहे हैं?',
    chatPlaceholder: 'संदेश लिखें...',
    chatThinking:    'सोच रहा हूँ...',
    chatError:       'माफ़ करें, मुझे समझने में परेशानी हुई। क्या आप फिर से कोशिश कर सकते हैं?',

    memSearchPlaceholder: 'यादें खोजें...',
    memFetching:          'यादें लोड हो रही हैं...',
    memEmpty:             'अभी कोई यादें नहीं',
    memEmptyBody:         'टाइप करके, रिकॉर्ड करके या फ़ोटो अपलोड करके एक याद जोड़ें।',
    memModalTitle:        'फ़ोटो याद अपलोड करें',
    memGallery:           '📷 गैलरी',
    memCamera:            '📸 कैमरा',
    memCaregiverNote:     'देखभालकर्ता नोट (वैकल्पिक)',
    memNotePlaceholder:   'जैसे "2019 दिवाली पर प्रिया"',
    memAnalyse:           'फ़ोटो सहेजें और विश्लेषण करें',
    memSaved:             'याद सहेजी गई!',
    memPeopleFound:       'लोग पहचाने गए',
    memPerson:            'व्यक्ति पहचाना गया',
    memDone:              'हो गया',

    peopleSearch:    'नाम या रिश्ते से खोजें...',
    peopleLoading:   'लोग लोड हो रहे हैं...',
    peopleEmpty:     'अभी कोई लोग नहीं जोड़े',
    peopleEmptyBody: 'कोई फ़ोटो अपलोड करें या परिवार के सदस्य का उल्लेख करते हुए याद जोड़ें।',
    peopleAddMemory: 'याद जोड़ें',
    ageLabel:        'उम्र:',

    addTitle:        'एक याद जोड़ें',
    addPlaceholder:  'एक याद, घटना या महत्वपूर्ण नोट लिखें...',
    addTypeNote:     'नोट',
    addTypeEvent:    'घटना',
    addTypePerson:   'व्यक्ति',
    addTypePlace:    'जगह',
    addSubmit:       'याद सहेजें',
    addSuccess:      'याद सहेजी गई!',

    settingsLanguage:   'भाषा',
    settingsBackend:    'बैकएंड URL',
    settingsPatient:    'मरीज़ ID',
    settingsSave:       'सेटिंग्स सहेजें',
    settingsSaved:      'सहेजा गया!',
    settingsAbout:      'MemoAI के बारे में',
    settingsAboutBody:  'MemoAI अल्जाइमर के मरीज़ों के लिए एक आवाज़-पहला स्मृति साथी है।',
    settingsDashboard:  'देखभालकर्ता डैशबोर्ड',

    dashTitle:       'देखभालकर्ता डैशबोर्ड',
    dashHealth:      'सिस्टम स्वास्थ्य',
    dashOnline:      'बैकएंड ऑनलाइन',
    dashOffline:     'बैकएंड ऑफ़लाइन',
    dashAlerts:      'संज्ञानात्मक निगरानी',
    dashAnomalyScore:'स्वास्थ्य स्कोर',
    dashAnomalyFlags:'पहचाने गए संकेत',
    dashNoAlerts:    'कोई चिंता नहीं मिली',
    dashCheck:       'जाँच चलाएँ',
    dashRecentLogs:  'हाल की बातचीत',
    dashRefresh:     'ताज़ा करें',
    dashDataExport:  'प्रशिक्षण डेटा निर्यात करें',
    dashStats:       'सत्र आंकड़े',
  },

  mr: {
    tabChat:      'संवाद',
    tabMemories:  'आठवणी',
    tabPeople:    'माणसे',
    tabAdd:       'जोडा',
    tabSettings:  'सेटिंग्ज',

    chatGreeting:    'नमस्कार! मी MemoAI आहे, तुमचा स्मृती सोबती. आज तुम्हाला कसे वाटत आहे?',
    chatPlaceholder: 'संदेश लिहा...',
    chatThinking:    'विचार करतो आहे...',
    chatError:       'माफ करा, मला समजण्यात अडचण आली. पुन्हा प्रयत्न करा का?',

    memSearchPlaceholder: 'आठवणी शोधा...',
    memFetching:          'आठवणी लोड होत आहेत...',
    memEmpty:             'अजून कोणत्या आठवणी नाहीत',
    memEmptyBody:         'टाइप करून, रेकॉर्ड करून किंवा फोटो अपलोड करून आठवण जोडा.',
    memModalTitle:        'फोटो आठवण अपलोड करा',
    memGallery:           '📷 गॅलरी',
    memCamera:            '📸 कॅमेरा',
    memCaregiverNote:     'काळजीवाहक टीप (पर्यायी)',
    memNotePlaceholder:   'उदा. "२०१९ च्या दिवाळीत प्रिया"',
    memAnalyse:           'फोटो जतन करा आणि विश्लेषण करा',
    memSaved:             'आठवण जतन झाली!',
    memPeopleFound:       'माणसे ओळखली',
    memPerson:            'व्यक्ती ओळखली',
    memDone:              'झाले',

    peopleSearch:    'नाव किंवा नात्याने शोधा...',
    peopleLoading:   'माणसे लोड होत आहेत...',
    peopleEmpty:     'अजून कोणी जोडले नाही',
    peopleEmptyBody: 'फोटो अपलोड करा किंवा कुटुंबातील सदस्याचा उल्लेख करणारी आठवण जोडा.',
    peopleAddMemory: 'आठवण जोडा',
    ageLabel:        'वय:',

    addTitle:        'आठवण जोडा',
    addPlaceholder:  'एखादी आठवण, प्रसंग किंवा महत्त्वाची टीप लिहा...',
    addTypeNote:     'टीप',
    addTypeEvent:    'प्रसंग',
    addTypePerson:   'व्यक्ती',
    addTypePlace:    'ठिकाण',
    addSubmit:       'आठवण जतन करा',
    addSuccess:      'आठवण जतन झाली!',

    settingsLanguage:   'भाषा',
    settingsBackend:    'बॅकएंड URL',
    settingsPatient:    'रुग्ण ID',
    settingsSave:       'सेटिंग्ज जतन करा',
    settingsSaved:      'जतन झाले!',
    settingsAbout:      'MemoAI बद्दल',
    settingsAboutBody:  'MemoAI अल्झायमर रुग्णांसाठी आवाज-प्रथम स्मृती सोबती आहे.',
    settingsDashboard:  'काळजीवाहक डॅशबोर्ड',

    dashTitle:       'काळजीवाहक डॅशबोर्ड',
    dashHealth:      'सिस्टम आरोग्य',
    dashOnline:      'बॅकएंड ऑनलाइन',
    dashOffline:     'बॅकएंड ऑफलाइन',
    dashAlerts:      'संज्ञानात्मक निरीक्षण',
    dashAnomalyScore:'आरोग्य गुण',
    dashAnomalyFlags:'आढळलेले संकेत',
    dashNoAlerts:    'कोणती चिंता आढळली नाही',
    dashCheck:       'तपासणी चालवा',
    dashRecentLogs:  'अलीकडील संवाद',
    dashRefresh:     'रिफ्रेश करा',
    dashDataExport:  'प्रशिक्षण डेटा निर्यात करा',
    dashStats:       'सत्र आकडेवारी',
  },
};

let currentLanguage = 'en';
const languageListeners = new Set();

export const LANGUAGES = [
  { code: 'en', label: 'English',  nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi',    nativeLabel: 'हिंदी' },
  { code: 'mr', label: 'Marathi',  nativeLabel: 'मराठी' },
];

export function t(key) {
  return translations[currentLanguage]?.[key] ?? translations['en']?.[key] ?? key;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    languageListeners.forEach(fn => fn(lang));
  }
}

export function getLanguage() {
  return currentLanguage;
}

export function onLanguageChange(fn) {
  languageListeners.add(fn);
  return () => languageListeners.delete(fn);
}
