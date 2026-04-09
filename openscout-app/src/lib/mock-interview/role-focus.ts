import type { InterviewLocale } from "@/lib/interview-locale";

type Seniority = "intern" | "junior" | "mid" | "senior";

type TopicMap = {
  architecture: string;
  coreLogic: string;
  consistency: string;
  scaling: string;
  failure: string;
  security: string;
  tradeoffs: string;
  finalPressure: string;
};

type RoleDescriptor = {
  key: string;
  matchers: RegExp[];
  focusEn: string;
  focusTr: string;
  adjacencyEn: string;
  adjacencyTr: string;
  avoidEn: string;
  avoidTr: string;
  topicMapEn: TopicMap;
  topicMapTr: TopicMap;
};

const ROLE_DESCRIPTORS: readonly RoleDescriptor[] = [
  {
    key: "android",
    matchers: [/\bandroid\b/i, /\bkotlin\b/i],
    focusEn:
      "Android architecture, Compose or Views, lifecycle, ViewModel, StateFlow/LiveData, coroutines, networking, offline sync, Room, WorkManager, ANR, memory, startup, testing, release risk.",
    focusTr:
      "Android architecture, Compose veya Views, lifecycle, ViewModel, StateFlow/LiveData, coroutine, networking, offline sync, Room, WorkManager, ANR, memory, startup, testing, release risk.",
    adjacencyEn: "Backend only from the Android client point of view: API contracts, retries, auth tokens, pagination, and sync rules.",
    adjacencyTr: "Backend'e sadece Android client acisindan gir: API contract, retry, auth token, pagination ve sync kurallari.",
    avoidEn:
      "Do not ask backend service ownership, distributed-systems design, iOS-only APIs, or infra scaling as primary topics.",
    avoidTr:
      "Backend servis ownership, distributed-systems design, iOS-only API veya infra scaling sorularini ana konu yapma.",
    topicMapEn: {
      architecture: "app architecture, module boundaries, and dependency graph choices",
      coreLogic: "UI state, lifecycle transitions, navigation, and client business logic",
      consistency: "offline sync, cache rules, retries, and state correctness on device",
      scaling: "startup, rendering, list performance, memory, app size, and battery costs",
      failure: "ANR, crashes, bad network, and background-task failure",
      security: "token storage, local data protection, permissions, and deep-link trust boundaries",
      tradeoffs: "Compose vs Views, local-first vs network-first, and modularization decisions",
      finalPressure: "release rollback, production incident, or migration under time pressure",
    },
    topicMapTr: {
      architecture: "app architecture, module boundary ve dependency graph secimleri",
      coreLogic: "UI state, lifecycle transition, navigation ve client business logic",
      consistency: "offline sync, cache kurallari, retry ve device ustunde state dogrulugu",
      scaling: "startup, rendering, liste performansi, memory, app size ve battery maliyeti",
      failure: "ANR, crash, kotu network ve background-task failure",
      security: "token storage, local data protection, permission ve deep-link trust boundary",
      tradeoffs: "Compose vs Views, local-first vs network-first ve modularization kararlari",
      finalPressure: "release rollback, production incident veya migration altinda zaman baskisi",
    },
  },
  {
    key: "ios",
    matchers: [/\bios\b/i, /\bswift\b/i],
    focusEn:
      "iOS architecture, UIKit or SwiftUI, view lifecycle, state, async/await or Combine, networking, local persistence, background work, launch performance, memory, crashes, testing, release safety.",
    focusTr:
      "iOS architecture, UIKit veya SwiftUI, view lifecycle, state, async/await veya Combine, networking, local persistence, background work, launch performance, memory, crash, testing, release safety.",
    adjacencyEn: "Backend only from the iOS client point of view: API behavior, auth, retries, and sync expectations.",
    adjacencyTr: "Backend'e sadece iOS client acisindan gir: API davranisi, auth, retry ve sync beklentisi.",
    avoidEn: "Do not drift into backend ownership, Android-only platform details, or infra operations as the main signal.",
    avoidTr: "Backend ownership, Android-only platform detayi veya infra operasyonlarini ana sinyal yapma.",
    topicMapEn: {
      architecture: "app architecture, feature boundaries, navigation, and dependency management",
      coreLogic: "view state, async workflows, networking, and local persistence",
      consistency: "cache rules, state restoration, offline behavior, and sync correctness",
      scaling: "launch performance, rendering, memory, battery, and binary/runtime cost",
      failure: "crashes, bad releases, background-task failures, and unstable network conditions",
      security: "keychain usage, token handling, local data protection, and permission/privacy boundaries",
      tradeoffs: "SwiftUI vs UIKit, async/await vs Combine, and migration strategy",
      finalPressure: "rollback, crash spike, or architecture decision under delivery pressure",
    },
    topicMapTr: {
      architecture: "app architecture, feature boundary, navigation ve dependency management",
      coreLogic: "view state, async workflow, networking ve local persistence",
      consistency: "cache kurallari, state restoration, offline davranis ve sync dogrulugu",
      scaling: "launch performance, rendering, memory, battery ve binary/runtime maliyeti",
      failure: "crash, kotu release, background-task failure ve dengesiz network kosullari",
      security: "keychain kullanimi, token handling, local data protection ve permission/privacy boundary",
      tradeoffs: "SwiftUI vs UIKit, async/await vs Combine ve migration stratejisi",
      finalPressure: "rollback, crash spike veya architecture karari altinda teslim baskisi",
    },
  },
  {
    key: "mobile",
    matchers: [/\bflutter\b/i, /\breact native\b/i, /\bmobile\b/i],
    focusEn:
      "Mobile client architecture, state management, navigation, platform boundaries, offline support, local storage, background execution, startup, rendering, memory, battery, crash debugging, release quality.",
    focusTr:
      "Mobile client architecture, state management, navigation, platform boundary, offline support, local storage, background execution, startup, rendering, memory, battery, crash debug, release quality.",
    adjacencyEn: "Backend only from the mobile client perspective: contracts, retries, auth, pagination, and sync behavior.",
    adjacencyTr: "Backend'e sadece mobile client perspektifinden gir: contract, retry, auth, pagination ve sync davranisi.",
    avoidEn: "Do not turn the interview into backend system design, browser internals, or unrelated infra ownership.",
    avoidTr: "Mulakati backend system design, browser internallari veya alakasiz infra ownership'ine cevirme.",
    topicMapEn: {
      architecture: "client architecture, module boundaries, and platform integration",
      coreLogic: "state management, navigation, async data flow, and runtime behavior",
      consistency: "offline state, local cache, retry semantics, and sync recovery",
      scaling: "startup, rendering, app size, memory, battery, and constrained-device performance",
      failure: "crashes, network loss, background failures, and release regressions",
      security: "token storage, local data safety, permissions, and mobile trust boundaries",
      tradeoffs: "state-management choices, native bridges, and release-risk decisions",
      finalPressure: "hotfix, rollout issue, or migration under shipping pressure",
    },
    topicMapTr: {
      architecture: "client architecture, module boundary ve platform integration",
      coreLogic: "state management, navigation, async data flow ve runtime davranisi",
      consistency: "offline state, local cache, retry semantigi ve sync recovery",
      scaling: "startup, rendering, app size, memory, battery ve kisitli cihaz performansi",
      failure: "crash, network kaybi, background failure ve release regresyonu",
      security: "token storage, local data safety, permission ve mobile trust boundary",
      tradeoffs: "state-management secimleri, native bridge ve release-risk kararlari",
      finalPressure: "hotfix, rollout sorunu veya migration altinda shipping baskisi",
    },
  },
  {
    key: "frontend",
    matchers: [/\bfrontend\b/i, /\breact\b/i, /\bweb developer\b/i, /\bwordpress\b/i],
    focusEn:
      "Rendering, component architecture, state management, browser behavior, accessibility, hydration/data fetching, client caching, UI performance, testing, and debugging production regressions.",
    focusTr:
      "Rendering, component architecture, state management, browser davranisi, accessibility, hydration/data fetching, client caching, UI performance, testing ve production regresyon debug'i.",
    adjacencyEn: "Backend only through API contracts, versioning, request/response shapes, caching boundaries, and auth flows seen by the client.",
    adjacencyTr: "Backend'e sadece API contract, versioning, request/response shape, cache boundary ve client'in gordugu auth flow ile gir.",
    avoidEn: "Do not ask mobile lifecycle, backend service internals, or infra operations as the primary signal.",
    avoidTr: "Mobile lifecycle, backend servis internallari veya infra operasyonlarini ana sinyal yapma.",
    topicMapEn: {
      architecture: "component boundaries, rendering strategy, and state ownership",
      coreLogic: "UI behavior, forms, client validation, state transitions, and browser/runtime mechanics",
      consistency: "optimistic UI, race conditions, cache invalidation, and client/server state coherence",
      scaling: "bundle size, hydration cost, rendering performance, and list virtualization",
      failure: "broken UI states, failed requests, stale data, and browser-side observability",
      security: "XSS, auth flows, token handling, and browser trust boundaries",
      tradeoffs: "SSR vs CSR, state-library choices, caching, and accessibility/perf balance",
      finalPressure: "production regression or rollout trade-off under performance pressure",
    },
    topicMapTr: {
      architecture: "component boundary, rendering stratejisi ve state ownership",
      coreLogic: "UI davranisi, form, client validation, state transition ve browser/runtime mekanigi",
      consistency: "optimistic UI, race condition, cache invalidation ve client/server state uyumu",
      scaling: "bundle size, hydration maliyeti, rendering performansi ve list virtualization",
      failure: "bozuk UI state, fail request, stale data ve browser-side observability",
      security: "XSS, auth flow, token handling ve browser trust boundary",
      tradeoffs: "SSR vs CSR, state-library secimleri, caching ve accessibility/perf dengesi",
      finalPressure: "production regresyonu veya rollout trade-off'u altinda performance baskisi",
    },
  },
  {
    key: "backend",
    matchers: [
      /\bbackend\b/i,
      /\.net\b/i,
      /\bnode\.js\b/i,
      /\bnodejs\b/i,
      /\bjava developer\b/i,
      /\bgo developer\b/i,
      /\bphp developer\b/i,
      /\bruby\b/i,
      /\brails\b/i,
      /\brust developer\b/i,
      /\bscala developer\b/i,
      /\bc\+\+ developer\b/i,
      /\bpython developer\b/i,
    ],
    focusEn:
      "Service architecture, API design, data modeling, transactions, consistency, concurrency, caching, queueing, observability, failure handling, performance, rollout safety, incident debugging, and backend security.",
    focusTr:
      "Servis architecture, API design, data modeling, transaction, consistency, concurrency, caching, queueing, observability, failure handling, performance, rollout safety, incident debug ve backend security.",
    adjacencyEn: "Clients only through API contracts, versioning, backwards compatibility, and integration constraints.",
    adjacencyTr: "Client'lara sadece API contract, versioning, backwards compatibility ve integration kisitlari uzerinden gir.",
    avoidEn: "Do not ask mobile lifecycle, Jetpack Compose/SwiftUI, browser rendering, or design-system questions as primary topics.",
    avoidTr: "Mobile lifecycle, Jetpack Compose/SwiftUI, browser rendering veya design-system sorularini ana konu yapma.",
    topicMapEn: {
      architecture: "service boundaries, data ownership, contracts, and dependency management",
      coreLogic: "request handling, business rules, async workflows, and storage interaction",
      consistency: "transactions, idempotency, cache coherence, event ordering, and data correctness",
      scaling: "throughput, latency, queues, partitioning, backpressure, and hot-spot mitigation",
      failure: "partial outage, retries, rollback, recovery, and production fault handling",
      security: "authn/authz, secrets, privacy, tenant isolation, and abuse boundaries",
      tradeoffs: "consistency vs availability, cache strategy, sync vs async, and operational complexity",
      finalPressure: "incident response or migration decision under production pressure",
    },
    topicMapTr: {
      architecture: "service boundary, data ownership, contract ve dependency management",
      coreLogic: "request handling, business rule, async workflow ve storage etkilesimi",
      consistency: "transaction, idempotency, cache uyumu, event ordering ve data dogrulugu",
      scaling: "throughput, latency, queue, partitioning, backpressure ve hot-spot azaltma",
      failure: "partial outage, retry, rollback, recovery ve production fault handling",
      security: "authn/authz, secret, privacy, tenant isolation ve abuse boundary",
      tradeoffs: "consistency vs availability, cache stratejisi, sync vs async ve operasyonel complexity",
      finalPressure: "incident response veya migration karari altinda production baskisi",
    },
  },
  {
    key: "fullstack",
    matchers: [/\bfull stack\b/i, /\bsoftware engineer\b/i, /\bcomputer programmer\b/i],
    focusEn:
      "End-to-end architecture across client, server, data flow, integration points, debugging, performance, correctness, and release trade-offs.",
    focusTr:
      "Client, server, data flow, integration noktalarinda end-to-end architecture, debug, performance, correctness ve release trade-off.",
    adjacencyEn: "Client and server are both in scope, but stay on ownership and decisions a full-stack engineer would realistically make.",
    adjacencyTr: "Client ve server ikisi de kapsamda olabilir ama full-stack bir muhendisin gercekte sahiplenecegi kararlar etrafinda kal.",
    avoidEn: "Do not drift into pure mobile platform internals or deep infra ownership unless the title explicitly says so.",
    avoidTr: "Title acikca soylemiyorsa saf mobile platform internali veya derin infra ownership'ine kayma.",
    topicMapEn: {
      architecture: "client/server boundaries, data flow, and integration design",
      coreLogic: "UI plus API behavior, business rules, and end-to-end correctness",
      consistency: "shared contracts, cache/state coherence, and data integrity across layers",
      scaling: "frontend performance, backend latency, and bottlenecks that affect users",
      failure: "cross-layer failures, debugging regressions, and safe rollback paths",
      security: "auth flows, session/token handling, and trust boundaries end to end",
      tradeoffs: "where logic lives, sync vs async, caching, and complexity across the stack",
      finalPressure: "urgent production issue or architecture choice with full-stack consequences",
    },
    topicMapTr: {
      architecture: "client/server boundary, data flow ve integration design",
      coreLogic: "UI ile API davranisi, business rule ve end-to-end correctness",
      consistency: "ortak contract, cache/state uyumu ve katmanlar arasi data butunlugu",
      scaling: "frontend performansi, backend latency ve kullaniciya yansiyan bottleneck",
      failure: "cross-layer failure, regresyon debug'i ve guvenli rollback yolu",
      security: "auth flow, session/token handling ve end-to-end trust boundary",
      tradeoffs: "logic placement, sync vs async, caching ve stack geneli complexity",
      finalPressure: "full-stack etkili acil production sorunu veya architecture secimi",
    },
  },
  {
    key: "ml_ai",
    matchers: [/\bai engineer\b/i, /\bmachine learning\b/i, /\bmlops\b/i, /\bnlp\b/i, /\bcomputer vision\b/i],
    focusEn:
      "Data quality, features, model behavior, evaluation, monitoring, drift, bias, latency, cost, serving, rollback, experimentation, and production ML reliability.",
    focusTr:
      "Data quality, feature, model davranisi, evaluation, monitoring, drift, bias, latency, cost, serving, rollback, experiment ve production ML reliability.",
    adjacencyEn: "Backend or data infrastructure only when it directly supports training, serving, monitoring, or experimentation.",
    adjacencyTr: "Backend veya data infrastructure'a ancak training, serving, monitoring veya experiment'i direkt destekliyorsa gir.",
    avoidEn: "Do not drift into generic frontend/mobile implementation or unrelated product questions as the main signal.",
    avoidTr: "Generic frontend/mobile implementasyon veya alakasiz product sorularina ana sinyal olarak kayma.",
    topicMapEn: {
      architecture: "training/serving boundaries, data pipeline ownership, and evaluation design",
      coreLogic: "feature/model reasoning, inference workflow, and applied decision making",
      consistency: "data correctness, label quality, reproducibility, and offline/online parity",
      scaling: "latency, throughput, serving cost, experiment scale, and capacity",
      failure: "drift, bad deployments, degraded predictions, feedback loops, and rollback",
      security: "data privacy, model abuse, prompt/model injection, and access boundaries",
      tradeoffs: "accuracy vs latency/cost, offline vs online metrics, and experiment design",
      finalPressure: "model degradation or launch decision under reliability pressure",
    },
    topicMapTr: {
      architecture: "training/serving boundary, data pipeline ownership ve evaluation design",
      coreLogic: "feature/model reasoning, inference workflow ve applied karar alma",
      consistency: "data dogrulugu, label kalitesi, reproducibility ve offline/online parity",
      scaling: "latency, throughput, serving cost, experiment olcegi ve kapasite",
      failure: "drift, kotu deployment, bozulan prediction, feedback loop ve rollback",
      security: "data privacy, model abuse, prompt/model injection ve access boundary",
      tradeoffs: "accuracy vs latency/cost, offline vs online metric ve experiment design",
      finalPressure: "reliability baskisi altinda model bozulmasi veya launch karari",
    },
  },
  {
    key: "data",
    matchers: [
      /\bdata engineer\b/i,
      /\bdata analyst\b/i,
      /\bdata scientist\b/i,
      /\bdata architect\b/i,
      /\bdata analytics\b/i,
      /\bbi analyst\b/i,
      /\bdatabase administrator\b/i,
    ],
    focusEn:
      "Data modeling, pipelines, storage layout, query correctness, quality controls, lineage, freshness, governance, performance, cost, and debugging in production data systems.",
    focusTr:
      "Data modeling, pipeline, storage layout, query dogrulugu, quality control, lineage, freshness, governance, performance, cost ve production data sistemlerinde debug.",
    adjacencyEn: "Application context only when it affects data contracts, events, ingestion, or consumer reliability.",
    adjacencyTr: "Application baglamina sadece data contract, event, ingestion veya consumer reliability'yi etkiliyorsa gir.",
    avoidEn: "Do not turn the interview into mobile/UI questions or generic software trivia outside the data role's responsibilities.",
    avoidTr: "Mulakati mobile/UI sorularina veya data rolunun sorumlulugu disindaki generic software trivia'ya cevirme.",
    topicMapEn: {
      architecture: "data model, ingestion design, storage layout, and consumer boundaries",
      coreLogic: "transformations, query logic, orchestration, and correctness checks",
      consistency: "schema evolution, data quality, lineage, freshness, and reproducibility",
      scaling: "volume growth, partitioning, query performance, throughput, and cost",
      failure: "broken pipelines, bad backfills, late data, recovery, and incident diagnosis",
      security: "data access, PII handling, governance, and auditability",
      tradeoffs: "warehouse vs lake, batch vs streaming, normalization vs denormalization, and cost/perf balance",
      finalPressure: "bad-data incident or architecture choice under trust pressure",
    },
    topicMapTr: {
      architecture: "data model, ingestion design, storage layout ve consumer boundary",
      coreLogic: "transformation, query logic, orchestration ve correctness check",
      consistency: "schema evolution, data quality, lineage, freshness ve reproducibility",
      scaling: "hacim buyumesi, partitioning, query performansi, throughput ve cost",
      failure: "bozuk pipeline, hatali backfill, gec gelen data, recovery ve incident teshisi",
      security: "data access, PII handling, governance ve auditability",
      tradeoffs: "warehouse vs lake, batch vs streaming, normalization vs denormalization ve cost/perf dengesi",
      finalPressure: "guven baskisi altinda hatali data incident'i veya architecture secimi",
    },
  },
  {
    key: "security",
    matchers: [/\bsecurity\b/i, /\bcybersecurity\b/i],
    focusEn:
      "Threat modeling, authn/authz, secrets, privacy, blast radius, secure architecture, incident response, remediation, and practical security trade-offs.",
    focusTr:
      "Threat modeling, authn/authz, secret, privacy, blast radius, secure architecture, incident response, remediation ve pratik security trade-off.",
    adjacencyEn: "Application or infrastructure details are allowed only through their security impact, control boundaries, and incident response consequences.",
    adjacencyTr: "Application veya infrastructure detayina sadece security etkisi, control boundary ve incident response sonucu uzerinden gir.",
    avoidEn: "Do not drift into generic backend/mobile/frontend implementation unless it is directly needed for the security question.",
    avoidTr: "Security sorusu icin direkt gerekmiyorsa generic backend/mobile/frontend implementasyona kayma.",
    topicMapEn: {
      architecture: "trust boundaries, attack surface, and control design",
      coreLogic: "auth flows, policy enforcement, and secure implementation choices",
      consistency: "policy correctness, auditability, and control coverage",
      scaling: "key rotation, tenant isolation, security operations, and abuse resistance at scale",
      failure: "incident triage, containment, remediation, and learning after exposure",
      security: "the primary threat, control, or privacy mechanism for the role",
      tradeoffs: "usability vs security, cost vs coverage, and prevention vs detection",
      finalPressure: "active incident or risky launch decision with security implications",
    },
    topicMapTr: {
      architecture: "trust boundary, attack surface ve control design",
      coreLogic: "auth flow, policy enforcement ve secure implementasyon secimleri",
      consistency: "policy dogrulugu, auditability ve control coverage",
      scaling: "key rotation, tenant isolation, security operasyonu ve abuse direnci",
      failure: "incident triage, containment, remediation ve ifsa sonrasi ogrenim",
      security: "role icin birincil threat, control veya privacy mekanizmasi",
      tradeoffs: "usability vs security, cost vs coverage ve prevention vs detection",
      finalPressure: "security etkili aktif incident veya riskli launch karari",
    },
  },
  {
    key: "qa",
    matchers: [/\bqa\b/i, /\btest automation\b/i],
    focusEn:
      "Test strategy, automation depth, risk-based coverage, flaky control, release quality signals, regression debugging, CI gates, and production feedback loops.",
    focusTr:
      "Test stratejisi, automation derinligi, risk-based coverage, flaky kontrolu, release quality sinyalleri, regresyon debug'i, CI gate ve production feedback loop.",
    adjacencyEn: "Application details are allowed only when they affect testability, failure isolation, release confidence, or production quality signal.",
    adjacencyTr: "Application detayina sadece test edilebilirlik, failure isolation, release confidence veya production quality sinyalini etkiliyorsa gir.",
    avoidEn: "Do not drift into pure product-management chat or deep implementation ownership outside what a QA/test role should drive.",
    avoidTr: "QA/test rolunun surmeyecegi saf product-management sohbeti veya derin implementasyon ownership'ine kayma.",
    topicMapEn: {
      architecture: "test architecture, environments, data strategy, and ownership boundaries",
      coreLogic: "test design, automation choices, failure isolation, and debugging flow",
      consistency: "signal quality, deterministic checks, flaky control, and reproducibility",
      scaling: "suite runtime, parallelization, coverage strategy, and CI efficiency",
      failure: "regression response, triage, release blocking, and production-quality feedback",
      security: "security testing surfaces, permission checks, and data/privacy validation",
      tradeoffs: "speed vs confidence, automation depth, and maintenance cost",
      finalPressure: "risky release decision under incomplete signal and time pressure",
    },
    topicMapTr: {
      architecture: "test architecture, environment, data stratejisi ve ownership boundary",
      coreLogic: "test design, automation secimleri, failure isolation ve debug akisi",
      consistency: "signal kalitesi, deterministic check, flaky kontrolu ve reproducibility",
      scaling: "suite runtime, parallelization, coverage stratejisi ve CI verimi",
      failure: "regresyon tepkisi, triage, release block ve production-quality geri bildirimi",
      security: "security testing yuzeyleri, permission check ve data/privacy dogrulamasi",
      tradeoffs: "hiz vs confidence, automation derinligi ve maintenance cost",
      finalPressure: "eksik sinyal ve zaman baskisi altinda riskli release karari",
    },
  },
  {
    key: "devops",
    matchers: [
      /\bdevops\b/i,
      /\bsite reliability\b/i,
      /\bsre\b/i,
      /\bcloud engineer\b/i,
      /\bplatform engineer\b/i,
      /\brelease manager\b/i,
      /\bnetwork engineer\b/i,
      /\bsystems administrator\b/i,
      /\bit support\b/i,
    ],
    focusEn:
      "Operational reliability, deployment safety, observability, incident response, automation, security posture, quality gates, capacity, recovery, and production hardening.",
    focusTr:
      "Operasyonel reliability, deployment safety, observability, incident response, automation, security posture, quality gate, capacity, recovery ve production hardening.",
    adjacencyEn: "Application details are allowed only when they affect deployability, observability, risk, security, or release confidence.",
    adjacencyTr: "Application detaylari sadece deployability, observability, risk, security veya release confidence'i etkiliyorsa girebilir.",
    avoidEn: "Do not drift into product-management chat or unrelated client-framework trivia as the primary focus.",
    avoidTr: "Ana odagi product-management sohbetine veya alakasiz client-framework trivia'sina kaydirma.",
    topicMapEn: {
      architecture: "platform boundaries, operational interfaces, and control points",
      coreLogic: "automation, CI/CD, runtime controls, quality gates, and system operation",
      consistency: "config correctness, environment drift, release reproducibility, and rollback safety",
      scaling: "capacity, autoscaling, bottlenecks, runtime cost, and operational load",
      failure: "incidents, alerting, triage, mitigation, and postmortem learning",
      security: "secrets, access control, network/runtime hardening, and auditability",
      tradeoffs: "speed vs safety, reliability vs cost, automation vs manual control",
      finalPressure: "high-severity incident or risky release under operational pressure",
    },
    topicMapTr: {
      architecture: "platform boundary, operasyonel arayuz ve kontrol noktasi",
      coreLogic: "automation, CI/CD, runtime control, quality gate ve sistem operasyonu",
      consistency: "config dogrulugu, environment drift, release reproducibility ve rollback safety",
      scaling: "capacity, autoscaling, bottleneck, runtime cost ve operasyonel yuk",
      failure: "incident, alerting, triage, mitigation ve postmortem ogrenimi",
      security: "secret, access control, network/runtime hardening ve auditability",
      tradeoffs: "hiz vs safety, reliability vs cost, automation vs manual control",
      finalPressure: "operasyonel baski altinda yuksek onemli incident veya riskli release",
    },
  },
  {
    key: "business",
    matchers: [
      /\bproduct\b/i,
      /\bdesigner\b/i,
      /\bux\b/i,
      /\bmarketing\b/i,
      /\bgrowth\b/i,
      /\bseo\b/i,
      /\bbrand\b/i,
      /\bcopywriter\b/i,
      /\bsales\b/i,
      /\baccount executive\b/i,
      /\bcustomer success\b/i,
      /\bcustomer support\b/i,
      /\bbusiness development\b/i,
      /\brecruiter\b/i,
      /\bhr\b/i,
      /\bhuman resources\b/i,
      /\bpeople operations\b/i,
      /\bfinance\b/i,
      /\baccountant\b/i,
      /\blegal\b/i,
      /\bprocurement\b/i,
      /\boperations\b/i,
      /\boffice manager\b/i,
      /\bexecutive assistant\b/i,
      /\bchief of staff\b/i,
      /\bproject manager\b/i,
      /\bprogram manager\b/i,
      /\bagile coach\b/i,
      /\bscrum master\b/i,
    ],
    focusEn:
      "Role-specific execution, process quality, stakeholder management, measurable outcomes, decision making, tooling, and failure handling inside the exact chosen discipline.",
    focusTr:
      "Secilen disiplin icindeki role-ozel execution, process kalitesi, stakeholder management, olculebilir sonuc, karar alma, tooling ve failure handling.",
    adjacencyEn: "Adjacent functions are allowed only when they are part of this role's real collaboration surface or operating constraints.",
    adjacencyTr: "Yakin fonksiyonlara sadece bu role'un gercek isbirligi yuzeyi veya operasyonel kisiti ise gir.",
    avoidEn: "Do not ask software-engineering implementation questions unless the role explicitly owns them.",
    avoidTr: "Rol acikca sahip degilse software-engineering implementasyon sorulari sorma.",
    topicMapEn: {
      architecture: "operating model, ownership boundaries, workflow design, and decision structure",
      coreLogic: "execution mechanics, prioritization, analysis quality, and role-specific craft",
      consistency: "quality controls, stakeholder alignment, metrics, and repeatability",
      scaling: "scope growth, team/process scale, tooling, and outcome efficiency",
      failure: "missed goals, broken process, recovery actions, and learning loops",
      security: "risk, privacy, compliance, or trust boundaries relevant to the role",
      tradeoffs: "scope, speed, quality, stakeholder, and resource trade-offs",
      finalPressure: "high-stakes decision under deadline, ambiguity, or stakeholder pressure",
    },
    topicMapTr: {
      architecture: "operating model, ownership boundary, workflow design ve karar yapisi",
      coreLogic: "execution mekanigi, onceliklendirme, analiz kalitesi ve role-ozel craft",
      consistency: "quality control, stakeholder hizasi, metric ve tekrar edilebilirlik",
      scaling: "kapsam buyumesi, ekip/process olcegi, tooling ve sonuc verimi",
      failure: "kacan hedef, bozulan surec, recovery aksiyonu ve ogrenme dongusu",
      security: "role ilgili risk, privacy, compliance veya trust boundary",
      tradeoffs: "scope, hiz, kalite, stakeholder ve kaynak trade-off'u",
      finalPressure: "deadline, ambiguity veya stakeholder baskisi altinda yuksek etkili karar",
    },
  },
];

type CuratedTopicPack = {
  en: {
    junior: string;
    mid: string;
    senior: string;
  };
  tr: {
    junior: string;
    mid: string;
    senior: string;
  };
};

const CURATED_TOPIC_PACKS: Record<string, CuratedTopicPack> = {
  android: {
    en: {
      junior:
        "Architecture Components, Activity vs Fragment boundaries, RecyclerView or lazy list state, Context usage, Retrofit calls, remember vs rememberSaveable, ViewModel plus StateFlow, MVVM implementation.",
      mid:
        "LiveData vs StateFlow, Clean Architecture boundaries, suspend vs async, offline-first sync, Hilt dependency injection, shared ViewModel state, startup optimization, hot vs cold flows, single-use events.",
      senior:
        "Legacy app refactor, ANR diagnosis, memory leak isolation, modular migration, real-time sync, performance vs maintainability trade-offs, offline-first Android architecture, test strategy and technical leadership.",
    },
    tr: {
      junior:
        "Architecture Components, Activity vs Fragment sinirlari, RecyclerView veya lazy list state, Context kullanimi, Retrofit cagrilari, remember vs rememberSaveable, ViewModel plus StateFlow, MVVM implementasyonu.",
      mid:
        "LiveData vs StateFlow, Clean Architecture sinirlari, suspend vs async, offline-first sync, Hilt dependency injection, shared ViewModel state, startup optimization, hot vs cold flow, single-use event.",
      senior:
        "Legacy app refactor, ANR teshisi, memory leak izolasyonu, modular migration, real-time sync, performance vs maintainability trade-off, offline-first Android mimarisi, test stratejisi ve teknik liderlik.",
    },
  },
  ios: {
    en: {
      junior:
        "UIKit vs SwiftUI boundaries, view lifecycle, state handling, URLSession networking, local persistence basics, dependency injection basics, async workflow understanding, navigation ownership.",
      mid:
        "Combine vs async/await, coordinator or navigation architecture, offline-first sync, background execution limits, launch optimization, memory diagnostics, testing strategy, modularization boundaries.",
      senior:
        "Legacy UIKit to SwiftUI migration, crash spike diagnosis, memory leak resolution, release rollback strategy, app architecture refactor, performance vs maintainability trade-offs, mentoring and code-quality leadership.",
    },
    tr: {
      junior:
        "UIKit vs SwiftUI sinirlari, view lifecycle, state handling, URLSession networking, local persistence temelleri, dependency injection temelleri, async workflow anlayisi, navigation ownership.",
      mid:
        "Combine vs async/await, coordinator veya navigation architecture, offline-first sync, background execution limitleri, launch optimization, memory teshisi, test stratejisi, modularization sinirlari.",
      senior:
        "Legacy UIKit -> SwiftUI migration, crash spike teshisi, memory leak cozumu, release rollback stratejisi, app architecture refactor, performance vs maintainability trade-off, mentorluk ve kod kalitesi liderligi.",
    },
  },
  mobile: {
    en: {
      junior:
        "State management, navigation, local storage, networking, offline handling, list performance, platform bridge basics, build and release safety.",
      mid:
        "Offline-first sync, background execution, platform-specific edge cases, startup optimization, crash and memory debugging, dependency boundaries, testing strategy, update rollout control.",
      senior:
        "Legacy mobile architecture refactor, release-risk management, modular migration, real-time sync, battery/performance trade-offs, platform integration strategy, incident diagnosis and team guidance.",
    },
    tr: {
      junior:
        "State management, navigation, local storage, networking, offline handling, liste performansi, platform bridge temelleri, build ve release safety.",
      mid:
        "Offline-first sync, background execution, platform-spesifik edge case, startup optimization, crash ve memory debug, dependency boundary, test stratejisi, update rollout kontrolu.",
      senior:
        "Legacy mobile architecture refactor, release-risk yonetimi, modular migration, real-time sync, battery/performance trade-off, platform integration stratejisi, incident teshisi ve ekip yonlendirmesi.",
    },
  },
  frontend: {
    en: {
      junior:
        "Rendering basics, component composition, local vs shared state, forms, API fetching, accessibility basics, browser event flow, simple performance pitfalls.",
      mid:
        "SSR vs CSR boundaries, data fetching and caching, optimistic UI, state consistency, performance profiling, accessibility under dynamic UI, design-system discipline, frontend testing strategy.",
      senior:
        "Legacy frontend refactor, architecture for large apps, hydration or rendering regressions, observability for UI failures, rollout safety, accessibility at scale, performance vs maintainability trade-offs.",
    },
    tr: {
      junior:
        "Rendering temelleri, component composition, local vs shared state, form, API fetch, accessibility temelleri, browser event flow, basit performans tuzaklari.",
      mid:
        "SSR vs CSR sinirlari, data fetching ve caching, optimistic UI, state consistency, performance profiling, dinamik UI'da accessibility, design-system disiplini, frontend test stratejisi.",
      senior:
        "Legacy frontend refactor, buyuk app architecture'i, hydration veya rendering regresyonu, UI failure icin observability, rollout safety, olcekte accessibility, performance vs maintainability trade-off.",
    },
  },
  backend: {
    en: {
      junior:
        "Request lifecycle, REST design basics, data modeling, SQL/index basics, auth/session flow, error handling, cache basics, idempotency fundamentals.",
      mid:
        "Transactions vs eventual consistency, queue and async job design, cache invalidation, pagination and search, observability, retries and backoff, API versioning, multi-service debugging.",
      senior:
        "Legacy monolith split, outage diagnosis, data migration strategy, scale bottleneck analysis, multi-region or tenancy trade-offs, security boundaries, architecture modernization, incident leadership.",
    },
    tr: {
      junior:
        "Request lifecycle, REST design temelleri, data modeling, SQL/index temelleri, auth/session akisi, error handling, cache temelleri, idempotency temelleri.",
      mid:
        "Transaction vs eventual consistency, queue ve async job tasarimi, cache invalidation, pagination ve search, observability, retry ve backoff, API versioning, multi-service debug.",
      senior:
        "Legacy monolith split, outage teshisi, data migration stratejisi, scale bottleneck analizi, multi-region veya tenancy trade-off, security boundary, architecture modernizasyonu, incident liderligi.",
    },
  },
  fullstack: {
    en: {
      junior:
        "End-to-end feature flow, client/server contracts, form-to-API path, auth basics, shared state and validation, debugging a broken feature across layers.",
      mid:
        "Where logic lives, caching across client and server, optimistic flows, API versioning impact on UI, performance bottlenecks end to end, testing strategy across layers.",
      senior:
        "Monolith to modular evolution, cross-layer incident debugging, architecture ownership, rollout safety across client and server, reliability vs delivery trade-offs, migration sequencing.",
    },
    tr: {
      junior:
        "End-to-end feature akisi, client/server contract, form-to-API yolu, auth temelleri, shared state ve validation, katmanlar arasi bozuk feature debug'i.",
      mid:
        "Logic placement, client/server caching, optimistic flow, API versioning'in UI etkisi, end-to-end performans bottleneck'i, katmanlar arasi test stratejisi.",
      senior:
        "Monolith -> modular evrim, cross-layer incident debug'i, architecture ownership, client/server genelinde rollout safety, reliability vs delivery trade-off, migration siralamasi.",
    },
  },
  ml_ai: {
    en: {
      junior:
        "Data quality, feature construction, model evaluation basics, offline vs online thinking, inference latency, experimentation basics, failure cases in predictions.",
      mid:
        "Model monitoring, drift, bias, online evaluation, rollback strategy, feature or label quality controls, serving architecture, cost vs quality trade-offs.",
      senior:
        "Legacy ML platform refactor, production model degradation diagnosis, evaluation strategy redesign, serving cost control, feedback-loop risk, org-level quality and reliability decisions.",
    },
    tr: {
      junior:
        "Data quality, feature construction, model evaluation temelleri, offline vs online dusunme, inference latency, experiment temelleri, prediction failure case'leri.",
      mid:
        "Model monitoring, drift, bias, online evaluation, rollback stratejisi, feature veya label quality kontrolu, serving architecture, cost vs quality trade-off.",
      senior:
        "Legacy ML platform refactor, production model bozulmasi teshisi, evaluation stratejisi yeniden tasarimi, serving cost kontrolu, feedback-loop riski, org seviyesinde kalite ve reliability kararlari.",
    },
  },
  data: {
    en: {
      junior:
        "SQL reasoning, schema design basics, ETL flow understanding, data quality checks, dashboard metric correctness, indexing or partitioning basics, debugging bad data.",
      mid:
        "Pipeline orchestration, schema evolution, lineage, reproducibility, freshness SLAs, batch vs streaming, cost-aware query design, backfill safety.",
      senior:
        "Warehouse or lake architecture, large backfill strategy, governance and PII boundaries, performance-cost trade-offs, incident response for bad data, platform modernization.",
    },
    tr: {
      junior:
        "SQL reasoning, schema design temelleri, ETL flow anlayisi, data quality check, dashboard metric dogrulugu, index veya partitioning temelleri, bozuk data debug'i.",
      mid:
        "Pipeline orchestration, schema evolution, lineage, reproducibility, freshness SLA, batch vs streaming, cost-aware query design, backfill safety.",
      senior:
        "Warehouse veya lake architecture, buyuk backfill stratejisi, governance ve PII sinirlari, performance-cost trade-off, hatali data incident response, platform modernizasyonu.",
    },
  },
  security: {
    en: {
      junior:
        "Threat-model basics, authn vs authz, secret handling, session or token risk, input validation, logging without leakage, basic abuse scenarios.",
      mid:
        "Threat modeling under real constraints, authorization design, key rotation, secure rollout, incident triage, privacy boundaries, balancing usability and control strength.",
      senior:
        "Security architecture refactor, blast-radius reduction, incident command, control coverage gaps, privacy or compliance trade-offs, detection vs prevention strategy.",
    },
    tr: {
      junior:
        "Threat model temelleri, authn vs authz, secret handling, session veya token riski, input validation, sizinti olmadan logging, temel abuse senaryolari.",
      mid:
        "Gercek kisit altinda threat modeling, authorization design, key rotation, secure rollout, incident triage, privacy sinirlari, usability ve kontrol gucu dengesi.",
      senior:
        "Security architecture refactor, blast-radius azaltma, incident command, control coverage bosluklari, privacy veya compliance trade-off, detection vs prevention stratejisi.",
    },
  },
  qa: {
    en: {
      junior:
        "Test-case design, API/UI basics, assertion quality, bug reproduction, flaky test diagnosis, exploratory testing, release-risk spotting.",
      mid:
        "Automation strategy, test pyramid decisions, contract tests, test data management, CI gates, flaky control, production quality signals, regression triage.",
      senior:
        "Quality strategy for large systems, organizational test ownership, release decision under incomplete signal, reliability metrics, shift-left trade-offs, modernization of the test stack.",
    },
    tr: {
      junior:
        "Test-case design, API/UI temelleri, assertion kalitesi, bug reproduction, flaky test teshisi, exploratory testing, release-risk yakalama.",
      mid:
        "Automation stratejisi, test pyramid kararlari, contract test, test data management, CI gate, flaky kontrolu, production quality sinyali, regresyon triage.",
      senior:
        "Buyuk sistemler icin quality stratejisi, organizasyonel test ownership, eksik sinyal altinda release karari, reliability metric, shift-left trade-off, test stack modernizasyonu.",
    },
  },
  devops: {
    en: {
      junior:
        "CI/CD basics, container/runtime understanding, logs and metrics, Linux or network troubleshooting, rollback basics, secret handling, infrastructure-as-code fundamentals.",
      mid:
        "Deployment safety, observability design, autoscaling, incident response, environment drift, release controls, secret rotation, cost-awareness in operations.",
      senior:
        "Platform evolution, disaster recovery strategy, high-severity incident leadership, multi-environment reliability, capacity planning, speed vs safety trade-offs, operational governance.",
    },
    tr: {
      junior:
        "CI/CD temelleri, container/runtime anlayisi, log ve metric, Linux veya network troubleshooting, rollback temelleri, secret handling, infrastructure-as-code temelleri.",
      mid:
        "Deployment safety, observability design, autoscaling, incident response, environment drift, release control, secret rotation, operasyonlarda cost farkindaligi.",
      senior:
        "Platform evrimi, disaster recovery stratejisi, yuksek onemli incident liderligi, multi-environment reliability, capacity planning, speed vs safety trade-off, operasyonel governance.",
    },
  },
  business: {
    en: {
      junior:
        "Role-specific tooling, workflow fundamentals, metric literacy, stakeholder communication, execution quality, prioritization basics, and handling routine edge cases.",
      mid:
        "Cross-functional trade-offs, process design, analytical rigor, quality controls, escalation handling, measurable outcomes, and failure recovery inside the role.",
      senior:
        "Operating-model redesign, stakeholder conflict resolution, strategy-to-execution trade-offs, org-level metrics, process modernization, and high-stakes decision making.",
    },
    tr: {
      junior:
        "Role-ozel tooling, workflow temelleri, metric okuryazarligi, stakeholder iletisim, execution kalitesi, onceliklendirme temelleri ve rutin edge case yonetimi.",
      mid:
        "Cross-functional trade-off, process design, analitik rigor, quality control, escalation handling, olculebilir sonuc ve role icinde failure recovery.",
      senior:
        "Operating-model redesign, stakeholder conflict cozumu, strategy-to-execution trade-off, org-level metric, process modernizasyonu ve yuksek etkili karar alma.",
    },
  },
};

function detectSeniority(jobCategory: string): Seniority {
  if (/\bintern\b/i.test(jobCategory)) return "intern";
  if (/\bjunior\b/i.test(jobCategory)) return "junior";
  if (/\bsenior\b|\bstaff\b|\bprincipal\b|\blead\b|\bmanager\b|\barchitect\b/i.test(jobCategory)) return "senior";
  return "mid";
}

function seniorityPolicy(locale: InterviewLocale, seniority: Seniority): string {
  if (locale === "tr") {
    switch (seniority) {
      case "intern":
      case "junior":
        return "Kisa ve role-kritik mekanizma sorulari sor. Gercek implementasyon anlayisini test ediyorsa kisa direkt teknik sorular serbest. Junior temelleri yapay bir senaryoya zorlama.";
      case "senior":
        return "Beginner tanim kontrolu yapma. Architecture, failure handling, debug, migration, performance ve baski altinda teknik muhakeme barini yuksek tut.";
      default:
        return "Direkt mekanizma sorulari ile kisa production senaryolarini dengele. Implementasyon detayi, reasoning, debug ve trade-off'u yokla; soruyu gereksiz uzatma.";
    }
  }

  switch (seniority) {
    case "intern":
    case "junior":
      return "Ask concise role-critical mechanism questions. Short direct technical prompts are allowed when they test real implementation understanding. Do not force junior fundamentals into an artificial scenario.";
    case "senior":
      return "Skip beginner definition checks. Raise the bar on architecture, failure handling, debugging, migrations, performance, and technical judgment under pressure.";
    default:
      return "Balance direct mechanism questions with concise production scenarios. Probe implementation detail, reasoning, debugging, and trade-offs without making the wording longer.";
  }
}

function detectRoleDescriptor(jobCategory: string): RoleDescriptor | null {
  return ROLE_DESCRIPTORS.find((descriptor) => descriptor.matchers.some((matcher) => matcher.test(jobCategory))) ?? null;
}

function packSeniorityKey(seniority: Seniority): "junior" | "mid" | "senior" {
  if (seniority === "intern") return "junior";
  return seniority;
}

function buildCuratedTopicPack(
  locale: InterviewLocale,
  roleKey: string,
  seniority: Seniority,
  jobCategory: string
): string {
  const pack = CURATED_TOPIC_PACKS[roleKey] ?? CURATED_TOPIC_PACKS.business;
  const key = packSeniorityKey(seniority);

  if (locale === "tr") {
    return `KURETE TOPIC PACK:
- Bu rol ve seviyede sorulari once su eksenlerden sec; mantigi kullan, birebir kopya etme.
- "${jobCategory}" icin oncelikli konu havuzu: ${pack.tr[key]}
- Soru kalibi: tek kavram, kisa prompt, net mekanizma veya failure/trade-off odagi.
- Bu pack disinda soru soracaksan yine ayni role'un ownership sinirinda kal.`;
  }

  return `CURATED TOPIC PACK:
- For this role and level, choose questions from these lanes first; use the logic, do not copy them verbatim.
- Priority topic pool for "${jobCategory}": ${pack.en[key]}
- Question shape: one concept, short prompt, clear mechanism focus or failure/trade-off pressure.
- If you go beyond this pack, stay inside the same role's ownership boundary.`;
}

export function buildRoleSpecificInterviewBrief(locale: InterviewLocale, jobCategory: string): string {
  const seniority = detectSeniority(jobCategory);
  const descriptor = detectRoleDescriptor(jobCategory);

  if (!descriptor) {
    if (locale === "tr") {
      return `ROL-OZEL MULAKAT OZETI:
- "${jobCategory}" ifadesini KATI uzmanlik siniri kabul et. Sorular yalnizca bu role ait ana sinyali test etsin.
- Sorulari gereksiz uzatma. Zorlugu daha teknik, daha spesifik ve daha production-gercek yap.
- Yakin alanlara sadece bu role'un sorumluluk acisindan gir; komsu disiplinleri ana konu yapma.
- Seviye kalibrasyonu: ${seniorityPolicy(locale, seniority)}
${buildCuratedTopicPack(locale, "business", seniority, jobCategory)}`;
    }

    return `ROLE-SPECIFIC INTERVIEW BRIEF:
- Treat "${jobCategory}" as a HARD specialization boundary. Every question must test signal that truly belongs to this role.
- Keep questions compact. Make them harder through technical specificity, production realism, sharper trade-offs, and debugging pressure.
- Adjacent domains are allowed only from this role's point of view; do not drift into neighboring disciplines as the main topic.
- Seniority calibration: ${seniorityPolicy(locale, seniority)}
${buildCuratedTopicPack(locale, "business", seniority, jobCategory)}`;
  }

  if (locale === "tr") {
    return `ROL-OZEL MULAKAT OZETI:
- "${jobCategory}" title'ini KATI uzmanlik siniri kabul et. Sorunun ana sinyali bu role ait olmali; komsu disipline kayma.
- Soruyu gereksiz uzatma. Zorlugu daha teknik, daha spesifik ve daha production-gercek yap.
- Fokus alanlari: ${descriptor.focusTr}
- Yakin alanlar sadece bu rolden bakarak sorulabilir: ${descriptor.adjacencyTr}
- Kapsam disi drift: ${descriptor.avoidTr}
- Topic flow'u bu role cevir:
  architecture -> ${descriptor.topicMapTr.architecture}
  core_logic -> ${descriptor.topicMapTr.coreLogic}
  consistency_correctness -> ${descriptor.topicMapTr.consistency}
  scaling -> ${descriptor.topicMapTr.scaling}
  failure_handling -> ${descriptor.topicMapTr.failure}
  security -> ${descriptor.topicMapTr.security}
  tradeoffs_decision -> ${descriptor.topicMapTr.tradeoffs}
  final_pressure -> ${descriptor.topicMapTr.finalPressure}
- Seviye kalibrasyonu: ${seniorityPolicy(locale, seniority)}
${buildCuratedTopicPack(locale, descriptor.key, seniority, jobCategory)}`;
  }

  return `ROLE-SPECIFIC INTERVIEW BRIEF:
- Treat "${jobCategory}" as a HARD specialization boundary. The main signal of every question must belong to this role, not a neighboring discipline.
- Keep the wording compact. Increase difficulty through technical specificity, production realism, and sharper trade-offs instead of longer setup.
- Focus areas: ${descriptor.focusEn}
- Adjacent topics are allowed only from this role's point of view: ${descriptor.adjacencyEn}
- Avoid drift into: ${descriptor.avoidEn}
- Translate the topic flow for this role:
  architecture -> ${descriptor.topicMapEn.architecture}
  core_logic -> ${descriptor.topicMapEn.coreLogic}
  consistency_correctness -> ${descriptor.topicMapEn.consistency}
  scaling -> ${descriptor.topicMapEn.scaling}
  failure_handling -> ${descriptor.topicMapEn.failure}
  security -> ${descriptor.topicMapEn.security}
  tradeoffs_decision -> ${descriptor.topicMapEn.tradeoffs}
  final_pressure -> ${descriptor.topicMapEn.finalPressure}
- Seniority calibration: ${seniorityPolicy(locale, seniority)}
${buildCuratedTopicPack(locale, descriptor.key, seniority, jobCategory)}`;
}
