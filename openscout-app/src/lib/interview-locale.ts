export type InterviewLocale = "en" | "tr";

export function parseInterviewLocale(raw: string | null | undefined): InterviewLocale {
  if (raw === "tr") return "tr";
  return "en";
}

export const INTERVIEW_LOCALE_LABEL: Record<InterviewLocale, string> = {
  en: "English",
  tr: "Türkçe",
};

export const interviewLocaleConfig: Record<
  InterviewLocale,
  { speechRecognitionLang: string }
> = {
  en: {
    speechRecognitionLang: "en-US",
  },
  tr: {
    speechRecognitionLang: "tr-TR",
  },
};

/** UI + client → AI cue strings per interview language */
export const interviewCopy = {
  en: {
    preparing: "Nova is preparing your interview...",
    readyPhrase: "Hello, I'm ready for the interview.",
    noResponseCue: "[Candidate did not respond within the time limit.]",
    notHeardCue:
      "[User was silent or speech was not recognized. Ask them to repeat briefly.]",
    fallbackOpening: "Hi — tell me a bit about yourself.",
    micDenied: "Microphone access denied. Please allow microphone and try again.",
    farewell: "That's a wrap — I'll get your results ready. Take care!",
    resultErrorImprovement: "Could not process the interview. Please try again.",
  },
  tr: {
    preparing: "Nova mülakatınızı hazırlıyor...",
    readyPhrase: "Merhaba, mülakata hazırım.",
    noResponseCue: "[Aday belirlenen süre içinde yanıt vermedi.]",
    notHeardCue:
      "[Kullanıcı sessiz kaldı veya konuşma algılanamadı. Kısaca tekrar etmesini iste.]",
    fallbackOpening: "Merhaba — biraz kendinizden bahseder misiniz?",
    micDenied: "Mikrofon erişimi reddedildi. Lütfen mikrofona izin verip tekrar deneyin.",
    farewell: "Mülakatımız bitti — sonuçlarınızı hazırlıyorum. Kendinize iyi bakın!",
    resultErrorImprovement: "Mülakat işlenemedi. Lütfen tekrar deneyin.",
  },
} as const;

export const interviewUi = {
  en: {
    mockInterviewTitle: "AI Mock Interview",
    mockInterviewSubtitle: "Select job category and practice with AI.",
    jobCategory: "Job Category",
    whatToExpect: "What to Expect",
    expectBullets: [
      "~20 minute conversation-style interview",
      "Questions about your background and career goals",
      "Role-specific technical questions",
      "Session is recorded and a report is generated",
    ],
    startInterview: "Start Interview",
    profileRequiredTitle: "Profile and CV required",
    profileRequiredBody:
      "Complete your profile (name, email, location) and run at least one CV analysis before starting a mock interview.",
    missingPrefix: "Missing",
    completeProfile: "Complete profile",
    runCvAnalysis: "Run CV analysis",
    testMicTitle: "Test Your Microphone",
    testMicHint: "Speak into your microphone. The bar below should move when you talk.",
    micWorking: "Microphone working! Speak to see the level, then continue.",
    continue: "Continue",
    processing: "Processing your interview...",
    endInterviewTitle: "End interview?",
    endInterviewBody:
      "Your responses will be evaluated and scored. This action cannot be undone.",
    continueInterview: "Continue interview",
    endEvaluate: "End & evaluate",
    interviewSuffix: "Interview",
    end: "End",
    statusWrapping: "Wrapping up...",
    statusWaitNova: "Wait for Nova to finish...",
    statusListening: "Listening...",
    statusClickToRespond: "Click to respond",
    voiceErrorPrefix: "Voice error",
    resultTitle: "Interview Result",
    resultTooShortLead: "The interview was too short to analyze.",
    resultReadyLead: "Your AI evaluation is ready.",
    resultTooShortBox:
      "The interview was shorter than 5 minutes, so it could not be analyzed. Please try again with a longer conversation to receive feedback and a score.",
    overallScore: "Overall Score",
    performanceSubtitle: "Your interview performance",
    strengths: "Strengths",
    improvements: "Improvement Suggestions",
    newInterview: "New Interview",
    dashboard: "Dashboard",
    shareScoutTitle: "Share your Scout Score",
    shareScoutBody:
      "One credential, many companies. Share this link so employers can see your AI-verified score and report.",
    copyLink: "Copy link",
    copied: "Copied!",
    shareSocial: "Share on LinkedIn / X",
    viewPass: "View pass",
    interviewLanguage: "Interview language",
  },
  tr: {
    mockInterviewTitle: "Yapay Zeka Deneme Mülakatı",
    mockInterviewSubtitle: "İş kategorisini seçin ve yapay zeka ile pratik yapın.",
    jobCategory: "İş kategorisi",
    whatToExpect: "Neler beklemelisiniz",
    expectBullets: [
      "Yaklaşık 20 dakikalık sohbet tarzı mülakat",
      "Geçmişiniz ve kariyer hedeflerinizle ilgili sorular",
      "Pozisyona özel teknik sorular",
      "Oturum kaydedilir ve bir rapor oluşturulur",
    ],
    startInterview: "Mülakatı başlat",
    profileRequiredTitle: "Profil ve özgeçmiş analizi gerekli",
    profileRequiredBody:
      "Deneme mülakatına başlamadan önce profilinizi (ad, e-posta, konum) tamamlayın ve en az bir özgeçmiş analizi çalıştırın.",
    missingPrefix: "Eksik",
    completeProfile: "Profili tamamla",
    runCvAnalysis: "Özgeçmiş analizi yap",
    testMicTitle: "Mikrofonunuzu test edin",
    testMicHint: "Mikrofona konuşun. Konuşurken aşağıdaki çubuğun hareket etmesi gerekir.",
    micWorking: "Mikrofon çalışıyor! Seviyeyi görmek için konuşun, ardından devam edin.",
    continue: "Devam",
    processing: "Mülakatınız işleniyor...",
    endInterviewTitle: "Mülakatı bitir?",
    endInterviewBody:
      "Yanıtlarınız değerlendirilip puanlanacak. Bu işlem geri alınamaz.",
    continueInterview: "Mülakata devam et",
    endEvaluate: "Bitir ve değerlendir",
    interviewSuffix: "mülakatı",
    end: "Bitir",
    statusWrapping: "Tamamlanıyor...",
    statusWaitNova: "Nova’nın konuşması bitene kadar bekleyin...",
    statusListening: "Dinleniyor...",
    statusClickToRespond: "Yanıtlamak için dokunun",
    voiceErrorPrefix: "Ses hatası",
    resultTitle: "Mülakat sonucu",
    resultTooShortLead: "Mülakat analiz için çok kısaydı.",
    resultReadyLead: "Yapay zeka değerlendirmeniz hazır.",
    resultTooShortBox:
      "Mülakat 5 dakikadan kısa sürdüğü için analiz edilemedi. Geri bildirim ve puan almak için lütfen daha uzun bir görüşmeyle tekrar deneyin.",
    overallScore: "Genel puan",
    performanceSubtitle: "Mülakat performansınız",
    strengths: "Güçlü yönler",
    improvements: "Geliştirme önerileri",
    newInterview: "Yeni mülakat",
    dashboard: "Panel",
    shareScoutTitle: "Scout puanınızı paylaşın",
    shareScoutBody:
      "Tek bir kimlik bilgisi, birçok şirket. İşverenlerin yapay zeka ile doğrulanmış puanınızı ve raporunuzu görmesi için bu bağlantıyı paylaşın.",
    copyLink: "Bağlantıyı kopyala",
    copied: "Kopyalandı!",
    shareSocial: "LinkedIn / X’te paylaş",
    viewPass: "Geçişi görüntüle",
    interviewLanguage: "Mülakat dili",
  },
} as const;
