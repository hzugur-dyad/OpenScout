import { INTERVIEW_CONTRACT_USER_LINES } from "@/lib/mock-interview/interview-contract-messages";

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
    noResponseCue: INTERVIEW_CONTRACT_USER_LINES.en.timeout,
    noAnswerRetryIntro: "I couldn't hear your response. Let me repeat the question.",
    responseDelayWarningCue: INTERVIEW_CONTRACT_USER_LINES.en.timeoutWarning,
    notHeardCue: INTERVIEW_CONTRACT_USER_LINES.en.silenceOrUnrecognized,
    silenceEscalateCue: INTERVIEW_CONTRACT_USER_LINES.en.silenceEscalate,
    fallbackOpening: "Hi — tell me a bit about yourself.",
    micDenied: "Microphone access denied. Please allow microphone and try again.",
    farewell: "That's a wrap — I'll get your results ready. Take care!",
    resultErrorImprovement: "Could not process the interview. Please try again.",
  },
  tr: {
    preparing: "Nova mülakatınızı hazırlıyor...",
    readyPhrase: "Merhaba, mülakata hazırım.",
    noResponseCue: INTERVIEW_CONTRACT_USER_LINES.tr.timeout,
    noAnswerRetryIntro: "Yanıtınızı duyamadım. Soruyu tekrar edeyim.",
    responseDelayWarningCue: INTERVIEW_CONTRACT_USER_LINES.tr.timeoutWarning,
    notHeardCue: INTERVIEW_CONTRACT_USER_LINES.tr.silenceOrUnrecognized,
    silenceEscalateCue: INTERVIEW_CONTRACT_USER_LINES.tr.silenceEscalate,
    fallbackOpening: "Merhaba — biraz kendinizden bahseder misiniz?",
    micDenied: "Mikrofon erişimi reddedildi. Lütfen mikrofona izin verip tekrar deneyin.",
    farewell: "Mülakatımız bitti — sonuçlarınızı hazırlıyorum. Kendinize iyi bakın!",
    resultErrorImprovement: "Mülakat işlenemedi. Lütfen tekrar deneyin.",
  },
} as const;

export const interviewUi = {
  en: {
    mockInterviewTitle: "Mock Interview",
    mockInterviewSubtitle: "Pick a job category and practice with Nova.",
    jobCategory: "Job Category",
    whatToExpect: "What to Expect",
    expectBullets: [
      "~20 minute conversation-style interview",
      "Questions about your background and career goals",
      "Role-specific technical questions",
      "Session is recorded and a report is generated",
    ],
    interviewTipsTitle: "Interview Guide",
    interviewTipsBullets: [
      "Keep answers structured: context -> action -> result.",
      "You can think briefly before answering, but avoid long pauses in the middle of a sentence.",
      "After Nova finishes a question, you have 7 seconds to start speaking. If you do not start, Nova repeats the same question once.",
      "After you start speaking, 4 seconds of silence or a mic tap ends your turn and sends it to Nova.",
      "Do not interrupt repeatedly; wait for Nova to finish speaking.",
      "Be concise, honest, and role-focused with concrete examples.",
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
    micAriaStartListening: "Start listening — speak your answer",
    micAriaStopListening: "Stop listening and submit your answer",
    endInterviewButtonAria: "End interview and get your evaluation",
    continueMicTestAria: "Continue to the interview",
    voiceErrorPrefix: "Voice error",
    interviewProviderError: "Nova could not respond (service busy or offline). Check your connection and try again.",
    interviewRateLimitError: "Too many interview requests in a short time. Please wait about a minute and try again.",
    resultTitle: "Interview Result",
    resultTooShortLead: "The interview was too short to analyze.",
    resultReadyLead: "Your mock interview evaluation is ready.",
    resultTooShortBox:
      "The interview was shorter than 5 minutes, so it could not be analyzed. Please try again with a longer conversation to receive feedback and a score.",
    overallScore: "Overall Score",
    performanceSubtitle: "Your interview performance",
    strengths: "Strengths",
    improvements: "Improvement Suggestions",
    newInterview: "New Interview",
    dashboard: "Dashboard",
    shareResultLead:
      "You earned a verified score—share it as proof of interview readiness. The public link shows highlights only, never your transcript.",
    shareScoutTitle: "Share your Scout Score",
    shareScoutBody:
      "Your Scout Pass is a single link employers can open to see AI-evaluated scores and strengths—professional signal without sending a recording.",
    copyLink: "Copy link",
    copied: "Copied!",
    shareSocial: "Share on LinkedIn / X",
    viewPass: "View pass",
    interviewLanguage: "Interview language",
    aiFeedbackTitle: "AI feedback",
    aiFeedbackSubtitle: "Why you received this score",
    scoreTechnical: "Technical",
    scoreCommunication: "Communication",
    scoreProblemSolving: "Problem solving",
    loadingResults: "Loading your results…",
    processingSubtitle: "Scoring your answers and drafting feedback",
    resultUnauthenticatedBody: "Sign in to view your result.",
    signInCta: "Sign in",
    resultNotFoundBody:
      "Interview results not found. Please complete the interview again.",
    resultEvalFailedBody:
      "We could not score this interview. Please try again from the mock interview page.",
    profileIncompleteTitle: "Complete your profile",
    profileIncompleteBody:
      "Add your name, email, and location before you can start a mock interview or apply to jobs.",
    noCvMaterialTitle: "CV required",
    noCvMaterialBody:
      "Upload a CV from your profile, or run CV analysis once with a file. Either option puts your résumé on file.",
    cvAnalysisNudgeTitle: "Run CV analysis first",
    cvAnalysisNudgeBody:
      "Your CV is uploaded. Run a quick analysis before starting the interview so Nova can tailor questions to your background.",
    nextAfterInterviewLine: "Next: Apply to jobs or improve your score.",
    applyToJobsCta: "Apply to jobs",
    takeAnotherInterviewCta: "Take another interview",
    applicationSubmittedLead: "Application submitted.",
    applicationSubmittedNext: "Next: Track your applications or explore another role.",
    myApplicationsCta: "My applications",
    browseMoreJobsCta: "Browse jobs",
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
    interviewTipsTitle: "Mülakat Rehberi",
    interviewTipsBullets: [
      "Yanıtlarını yapılandır: durum -> aksiyon -> sonuç.",
      "Cevap vermeden önce kısa düşünebilirsin; ama cümle içinde uzun duraksamalardan kaçın.",
      "Yaklaşık 18 saniye sessiz kalırsan Nova hatırlatma yapar; yaklaşık 42 saniye sessizlikte zaman aşımı tetiklenir.",
      "Konuşurken ~2.5 saniyeyi aşan duraksama olursa Nova cümlenin bittiğini düşünebilir.",
      "Sık sık söz kesme; Nova konuşmasını bitirsin.",
      "Kısa, net ve role uygun somut örnekler ver.",
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
    micAriaStartListening: "Dinlemeyi başlatın — yanıtınızı konuşarak verin",
    micAriaStopListening: "Dinlemeyi durdurun ve yanıtınızı gönderin",
    endInterviewButtonAria: "Mülakatı bitir ve değerlendirmeyi al",
    continueMicTestAria: "Mülakata devam et",
    voiceErrorPrefix: "Ses hatası",
    interviewProviderError:
      "Nova şu anda yanıt veremedi (servis meşgul veya çevrimdışı). Bağlantınızı kontrol edip tekrar deneyin.",
    interviewRateLimitError:
      "Kısa sürede çok fazla mülakat isteği gönderildi. Lütfen yaklaşık 1 dakika bekleyip tekrar deneyin.",
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
    shareResultLead:
      "Doğrulanmış bir puanınız var—mülakat hazırlığınızın kanıtı olarak paylaşabilirsiniz. Herkese açık bağlantıda yalnızca öne çıkanlar görünür, transkript asla paylaşılmaz.",
    shareScoutTitle: "Scout puanınızı paylaşın",
    shareScoutBody:
      "Scout Geçişiniz, işverenlerin yapay zeka ile değerlendirilmiş puanlarınızı ve güçlü yönlerinizi tek bağlantıda görmesini sağlar—kayıt göndermeden profesyonel bir sinyal.",
    copyLink: "Bağlantıyı kopyala",
    copied: "Kopyalandı!",
    shareSocial: "LinkedIn / X’te paylaş",
    viewPass: "Geçişi görüntüle",
    interviewLanguage: "Mülakat dili",
    aiFeedbackTitle: "Yapay zeka geri bildirimi",
    aiFeedbackSubtitle: "Bu puanın gerekçesi",
    scoreTechnical: "Teknik",
    scoreCommunication: "İletişim",
    scoreProblemSolving: "Problem çözme",
    loadingResults: "Sonuçlarınız yükleniyor…",
    processingSubtitle: "Yanıtlarınız puanlanıyor ve geri bildirim hazırlanıyor",
    resultUnauthenticatedBody: "Sonucunuzu görmek için giriş yapın.",
    signInCta: "Giriş yap",
    resultNotFoundBody:
      "Mülakat sonucu bulunamadı. Lütfen mülakatı yeniden tamamlayın.",
    resultEvalFailedBody:
      "Bu mülakat puanlanamadı. Lütfen deneme mülakatı sayfasından tekrar deneyin.",
    profileIncompleteTitle: "Profilinizi tamamlayın",
    profileIncompleteBody:
      "Deneme mülakatına veya başvuruya geçmeden önce adınızı, e-postanızı ve konumunuzu ekleyin.",
    noCvMaterialTitle: "Özgeçmiş gerekli",
    noCvMaterialBody:
      "Profilinizden bir özgeçmiş yükleyin veya bir dosya ile özgeçmiş analizi çalıştırın. İkisi de özgeçmişinizi sisteme ekler.",
    cvAnalysisNudgeTitle: "Önce özgeçmiş analizi yapın",
    cvAnalysisNudgeBody:
      "Özgeçmişiniz yüklü. Mülakata başlamadan önce kısa bir analiz çalıştırın; böylece Nova soruları geçmişinize göre uyarlayabilir.",
    nextAfterInterviewLine: "Sırada: İşlere başvurun veya puanınızı yükseltin.",
    applyToJobsCta: "İşlere başvur",
    takeAnotherInterviewCta: "Başka mülakat yap",
    applicationSubmittedLead: "Başvurunuz gönderildi.",
    applicationSubmittedNext: "Sırada: Başvurularınızı takip edin veya başka bir rol deneyin.",
    myApplicationsCta: "Başvurularım",
    browseMoreJobsCta: "İlanlara göz at",
  },
} as const;
