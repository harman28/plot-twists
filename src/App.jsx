import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore, Fragment } from "react";

function useIsMobile() {
  const subscribe = useCallback(cb => {
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
  }, []);
  return useSyncExternalStore(subscribe, () => window.innerWidth < 680, () => false);
}
import * as d3 from "d3";
import { supabase } from "./supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const THEMES = [
  { name: "AI Safety",          color: "#D48010" },
  { name: "AI Policy",          color: "#009B72" },
  { name: "Digital Justice",    color: "#E84E00" },
  { name: "Governance",         color: "#9B6230" },
  { name: "Bias and Fairness",  color: "#CC1E78" },
  { name: "Critical Computing", color: "#8020D8" },
  { name: "Environment",        color: "#0A9C60" },
  { name: "Ethics",             color: "#D03030" },
];
const COLOR = Object.fromEntries(THEMES.map(t => [t.name, t.color]));
// Palette for custom (user-defined) themes — distinct from the 8 built-in colours
const CUSTOM_PALETTE = ["#1068D4","#0891B2","#5B21B6","#65A30D","#C2185B","#0369A1","#9333EA","#047857","#B45309","#0F766E"];
function customThemeColor(name, customThemeColors = {}) {
  if (customThemeColors[name]) return customThemeColors[name];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return CUSTOM_PALETTE[h % CUSTOM_PALETTE.length];
}
const PATH_COLORS = ["#D48010","#0A9C60","#1068D4","#CC1E78","#8020D8","#E84E00"];

const ORG_STANCES = ["Industry","Policy / Think Tank","Journalism","Academic","Civil Society / Advocacy","Other"];
const STANCE_COLORS = {
  "Industry":                  "#1068D4",
  "Policy / Think Tank":       "#009B72",
  "Journalism":                "#D48010",
  "Academic":                  "#8020D8",
  "Civil Society / Advocacy":  "#E84E00",
  "Other":                     "#607890",
};

// Stable per-org hash for deterministic scatter within the donut band
function orgHash(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" }); }
function prevDay(d) { const dt = new Date(d+"T12:00:00"); dt.setDate(dt.getDate()-1); return dt.toISOString().slice(0,10); }
function nextDay(d) { const dt = new Date(d+"T12:00:00"); dt.setDate(dt.getDate()+1); return dt.toISOString().slice(0,10); }
function dateSeed(s) { return parseInt(s.replace(/-/g,""),10); }
function seededShuffle(arr, seed) {
  const a = [...arr]; let s = seed;
  for (let i = a.length-1; i > 0; i--) { s = (Math.imul(s,1664525)+1013904223)|0; const j = Math.abs(s)%(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function getDispatch(dateStr, pool) {
  const seed = dateSeed(dateStr);
  const na = pool.filter(x => x.type === "essay");
  const found = pool.filter(x => x.type === "foundational");
  const recent = pool.filter(x => x.type === "recent");
  return {
    nonAcademic: seededShuffle(na, seed).slice(0,4),
    academic: [...seededShuffle(recent, seed+1).slice(0,2), ...seededShuffle(found, seed+2).slice(0,2)]
  };
}

// ─── Built-in pool ────────────────────────────────────────────────────────────

const BUILTIN = [
  { id:"na1",  title:"AI Environmental Equity: 'It's Not Easy Being Green'", url:"https://themarkup.org/hello-world/2023/07/08/ai-environmental-equity-its-not-easy-being-green", source:"The Markup", published:"Jul 2023", keywords:["energy consumption","data centres","environmental equity"], readingMinutes:9, theme:"Environment", type:"essay" },
  { id:"na2",  title:"The Carbon Footprint of ChatGPT", url:"https://www.technologyreview.com/2022/11/14/1063192/the-carbon-footprint-of-chatgpt/", source:"MIT Technology Review", published:"Nov 2022", keywords:["carbon emissions","llm training","sustainability"], readingMinutes:7, theme:"Environment", type:"essay" },
  { id:"na3",  title:"The Secret Water Footprint of AI Technology", url:"https://themarkup.org/hello-world/2023/04/15/the-secret-water-footprint-of-ai-technology", source:"The Markup", published:"Apr 2023", keywords:["water consumption","data centres","environmental impact"], readingMinutes:8, theme:"Environment", type:"essay" },
  { id:"na4",  title:"The Hidden Environmental Cost of the Metaverse", url:"https://www.wired.com/story/hidden-environmental-cost-metaverse/", source:"Wired", published:"Nov 2022", keywords:["metaverse","energy use","environmental cost"], readingMinutes:8, theme:"Environment", type:"essay" },
  { id:"na5",  title:"How Much Energy Does AI Actually Use?", url:"https://www.technologyreview.com/2023/12/01/1084189/making-an-image-with-generative-ai-uses-as-much-energy-as-charging-your-phone/", source:"MIT Technology Review", published:"Dec 2023", keywords:["energy benchmarks","generative ai","carbon"], readingMinutes:7, theme:"Environment", type:"essay" },
  { id:"na7",  title:"Can AI and Sustainability Coexist?", url:"https://www.theguardian.com/technology/2023/jun/08/can-ai-and-sustainability-coexist", source:"The Guardian", published:"Jun 2023", keywords:["sustainability","ai emissions","green tech"], readingMinutes:8, theme:"Environment", type:"essay" },
  { id:"na8",  title:"Timnit Gebru on the Danger of AI Doomerism", url:"https://www.wired.com/story/timnit-gebru-ai-doomerism/", source:"Wired", published:"Mar 2023", keywords:["dair institute","ai harms","research culture"], readingMinutes:8, theme:"Ethics", type:"essay" },
  { id:"na9",  title:"A.I. Is Not Sentient. Why Do People Say It Is?", url:"https://www.nytimes.com/2022/08/05/technology/ai-sentient-google-lemoine.html", source:"New York Times", published:"Aug 2022", keywords:["ai consciousness","anthropomorphism","media framing"], readingMinutes:7, theme:"Ethics", type:"essay" },
  { id:"na10", title:"The Eyeball Economy of Algorithmic Extremism", url:"https://www.nytimes.com/2021/04/25/opinion/facebook-ai-extremism.html", source:"New York Times", published:"Apr 2021", keywords:["recommendation systems","radicalisation","engagement"], readingMinutes:8, theme:"Ethics", type:"essay" },
  { id:"na11", title:"Chatbots Won't Save Mental Health Care", url:"https://www.theatlantic.com/technology/archive/2023/10/mental-health-ai-chatbots/675579/", source:"The Atlantic", published:"Oct 2023", keywords:["mental health ai","therapeutic chatbots","care ethics"], readingMinutes:11, theme:"Ethics", type:"essay" },
  { id:"na12", title:"The Case for Slowing Down AI", url:"https://www.newyorker.com/science/annals-of-artificial-intelligence/the-case-for-slowing-down-ai", source:"The New Yorker", published:"Nov 2023", keywords:["ai pause","existential risk","responsible development"], readingMinutes:14, theme:"Ethics", type:"essay" },
  { id:"na13", title:"Big Tech Wants You to Think AI Will Kill Us All", url:"https://www.vice.com/en/article/cyber-big-tech-wants-you-to-think-ai-will-kill-us-all/", source:"Vice", published:"Jul 2024", keywords:["ai doom","corporate framing","accountability"], readingMinutes:9, theme:"Ethics", type:"essay" },
  { id:"na14", title:"We Need to Talk About How Good AI Is Getting at Lying", url:"https://www.technologyreview.com/2023/02/01/1067610/ai-is-getting-better-at-lying/", source:"MIT Technology Review", published:"Feb 2023", keywords:["deception","ai honesty","language models"], readingMinutes:8, theme:"Ethics", type:"essay" },
  { id:"na18", title:"Why the AI Safety Movement Needs to Grow Up", url:"https://www.vox.com/future-perfect/2023/8/18/23836362/ai-safety-movement-criticism", source:"Vox", published:"Aug 2023", keywords:["ai safety movement","effective altruism","critique"], readingMinutes:11, theme:"AI Safety", type:"essay" },
  { id:"na19", title:"Situational Awareness: What to Expect from AGI", url:"https://situational-awareness.ai", source:"Leopold Aschenbrenner", published:"Jun 2024", keywords:["agi forecasting","intelligence explosion","national security"], readingMinutes:90, theme:"AI Safety", type:"essay" },
  { id:"na20", title:"Anthropic's Responsible Scaling Policy Explained", url:"https://www.anthropic.com/news/anthropics-responsible-scaling-policy", source:"Anthropic", published:"Sep 2023", keywords:["responsible scaling","safety levels","frontier models"], readingMinutes:10, theme:"AI Safety", type:"essay" },
  { id:"na22", title:"How the EU AI Act Will Reshape Artificial Intelligence Globally", url:"https://www.technologyreview.com/2023/06/12/1074449/eu-ai-act-artificial-intelligence/", source:"MIT Technology Review", published:"Jun 2023", keywords:["eu ai act","regulation","global governance"], readingMinutes:9, theme:"AI Policy", type:"essay" },
  { id:"na23", title:"How the FTC Became the Main AI Watchdog", url:"https://www.politico.com/news/2023/06/20/ftc-ai-watchdog-00102620", source:"Politico", published:"Jun 2023", keywords:["ftc","us regulation","antitrust"], readingMinutes:8, theme:"AI Policy", type:"essay" },
  { id:"na24", title:"Who Owns the Generative AI Platform?", url:"https://a16z.com/who-owns-the-generative-ai-platform/", source:"a16z", published:"Jan 2023", keywords:["platform power","commoditisation","market structure"], readingMinutes:11, theme:"AI Policy", type:"essay" },
  { id:"na26", title:"Why Facial Recognition Technology Is So Hard to Regulate", url:"https://www.technologyreview.com/2022/03/07/1046979/facial-recognition-technology-hard-to-regulate/", source:"MIT Technology Review", published:"Mar 2022", keywords:["facial recognition","regulation","law enforcement"], readingMinutes:9, theme:"AI Policy", type:"essay" },
  { id:"na27", title:"The AI Governance Gap", url:"https://www.foreignaffairs.com/world/ai-governance-gap", source:"Foreign Affairs", published:"Dec 2023", keywords:["ai governance","international cooperation","regulatory gap"], readingMinutes:14, theme:"AI Policy", type:"essay" },
  { id:"na28", title:"OpenAI's Tumultuous Year and What It Means for AI Regulation", url:"https://www.wired.com/story/openai-altman-fired-board-regulation/", source:"Wired", published:"Nov 2023", keywords:["openai governance","board oversight","ai regulation"], readingMinutes:9, theme:"AI Policy", type:"essay" },
  { id:"na29", title:"Clearview AI Fined in UK for Facial Recognition Violations", url:"https://www.theguardian.com/technology/2022/may/23/clearview-ai-fined-in-uk-facial-recognition-database", source:"The Guardian", published:"May 2022", keywords:["facial recognition","privacy","gdpr"], readingMinutes:5, theme:"Governance", type:"essay" },
  { id:"na30", title:"How Amazon Sidewalk Became the Surveillance Network Next Door", url:"https://www.eff.org/deeplinks/2021/05/amazon-sidewalk-surveillance-network-next-door", source:"EFF", published:"May 2021", keywords:["amazon sidewalk","surveillance","iot"], readingMinutes:7, theme:"Governance", type:"essay" },
  { id:"na32", title:"More CCTV, More Crime: India's Most-Surveilled Cities Are the Least Safe", url:"https://restofworld.org/2023/cctv-crime-surveillance-india/", source:"Rest of World", published:"2023", keywords:["urban surveillance","cctv","data rights"], readingMinutes:11, theme:"Governance", type:"essay" },
  { id:"na33", title:"Platform Regulation Is Coming — But Will It Work?", url:"https://www.technologyreview.com/2023/05/10/1072967/platform-regulation-eu-dsa-dma/", source:"MIT Technology Review", published:"May 2023", keywords:["dsa","dma","platform regulation"], readingMinutes:10, theme:"Governance", type:"essay" },
  { id:"na34", title:"The Digital Poorhouse", url:"https://harpers.org/archive/2018/01/the-digital-poorhouse/", source:"Harper's Magazine", published:"Jan 2018", keywords:["welfare surveillance","automated decisions","poverty"], readingMinutes:22, theme:"Digital Justice", type:"essay" },
  { id:"na36", title:"Scale AI Uses Low-Paid Workers to Solve Tech's Language Problem", url:"https://restofworld.org/2023/scale-ai-language-training-hiring/", source:"Rest of World", published:"2023", keywords:["data labelling","pay disparity","labour rights"], readingMinutes:10, theme:"Digital Justice", type:"essay" },
  { id:"na39", title:"AI and the Global South: A Different Perspective", url:"https://www.aljazeera.com/opinions/2023/8/15/ai-and-the-global-south-a-different-perspective", source:"Al Jazeera", published:"Aug 2023", keywords:["global south","ai development","inequality"], readingMinutes:8, theme:"Digital Justice", type:"essay" },
  { id:"na40", title:"AI Hiring Tools May Be Filtering Out the Best Job Applicants", url:"https://www.bloomberg.com/news/articles/2023-02-08/ai-hiring-tools-may-be-filtering-out-the-best-job-applicants", source:"Bloomberg", published:"Feb 2023", keywords:["algorithmic hiring","bias","employment"], readingMinutes:7, theme:"Bias and Fairness", type:"essay" },
  { id:"na41", title:"In AI We (Don't) Trust", url:"https://themarkup.org/hello-world/2023/04/29/in-ai-we-dont-trust", source:"The Markup", published:"Apr 2023", keywords:["automation bias","algorithmic trust","error rates"], readingMinutes:8, theme:"Bias and Fairness", type:"essay" },
  { id:"na42", title:"Predictive Policing Explained", url:"https://www.brennancenter.org/our-work/research-reports/predictive-policing-explained", source:"Brennan Center", published:"Apr 2020", keywords:["predictive policing","race","criminal justice"], readingMinutes:9, theme:"Bias and Fairness", type:"essay" },
  { id:"na43", title:"Artificial Intelligence Has a Problem with Gender and Racial Bias", url:"https://www.media.mit.edu/articles/artificial-intelligence-has-a-problem-with-gender-and-racial-bias-here-s-how-to-solve-it/", source:"MIT Media Lab", published:"Feb 2019", keywords:["gender bias","racial bias","computer vision"], readingMinutes:8, theme:"Bias and Fairness", type:"essay" },
  { id:"na45", title:"Artificial Intelligence Is Creating a New Colonial World Order", url:"https://www.technologyreview.com/2022/04/19/1049592/artificial-intelligence-colonialism/", source:"MIT Technology Review", published:"Apr 2022", keywords:["ai colonialism","global south","power asymmetry"], readingMinutes:13, theme:"Critical Computing", type:"essay" },
  { id:"na47", title:"Resisting Reduction: A Manifesto", url:"https://jods.mitpress.mit.edu/pub/resisting-reduction/release/4", source:"MIT Press / JoDS", published:"Nov 2017", keywords:["techno-solutionism","complexity","systems thinking"], readingMinutes:15, theme:"Critical Computing", type:"essay" },
  { id:"na48", title:"The Automation Charade", url:"https://logicmag.io/failure/the-automation-charade/", source:"Logic Magazine", published:"Aug 2018", keywords:["automation myth","hidden labour","technology narrative"], readingMinutes:12, theme:"Critical Computing", type:"essay" },
  { id:"na49", title:"A.I. Chatbots Are Coming to Your Local Government", url:"https://www.nytimes.com/2023/07/18/technology/ai-local-government-chatbots.html", source:"New York Times", published:"Jul 2023", keywords:["local government","chatbots","public sector ai"], readingMinutes:8, theme:"Critical Computing", type:"essay" },
  { id:"na50", title:"Algorithms Are Making Government Decisions. The Public Needs to Have a Say.", url:"https://www.aclu.org/issues/privacy-technology/surveillance-technologies/algorithms-are-making-government-decisions", source:"ACLU", published:"2021", keywords:["algorithmic decisions","due process","public sector accountability"], readingMinutes:9, theme:"Critical Computing", type:"essay" },
  { id:"na52", title:"The Myth of Neutral AI", url:"https://www.technologyreview.com/2021/03/05/1020376/what-is-neutral-in-ai/", source:"MIT Technology Review", published:"Mar 2021", keywords:["value-ladenness","ai neutrality myth","design choices"], readingMinutes:8, theme:"Critical Computing", type:"essay" },
  { id:"na53", title:"Tech Was Supposed to Be a Meritocracy. In India, It Reinforces Old Caste Divides.", url:"https://restofworld.org/2022/tech-india-caste-divides/", source:"Rest of World", published:"2022", keywords:["caste discrimination","tech workplace","india"], readingMinutes:11, theme:"Bias and Fairness", type:"essay" },
  { id:"na54", title:"Disability and the Design of AI", url:"https://www.wired.com/story/disability-design-ai-accessibility/", source:"Wired", published:"Jun 2023", keywords:["disability","accessibility","ai design"], readingMinutes:9, theme:"Bias and Fairness", type:"essay" },
  { id:"na56", title:"How Tech Companies Captured the AI Safety Debate", url:"https://www.theatlantic.com/technology/archive/2023/06/ai-regulation-sam-altman-congress-testimony/674450/", source:"The Atlantic", published:"Jun 2023", keywords:["ai safety capture","regulation theater","lobbying"], readingMinutes:10, theme:"AI Policy", type:"essay" },
  { id:"na57", title:"China's AI Governance Model", url:"https://www.technologyreview.com/2023/07/03/1075849/china-ai-regulation-explained/", source:"MIT Technology Review", published:"Jul 2023", keywords:["china","ai regulation","comparative governance"], readingMinutes:9, theme:"Governance", type:"essay" },
  { id:"na60", title:"Structural Racism in AI Needs Structural Solutions", url:"https://www.technologyreview.com/2021/09/14/1036100/structural-racism-in-ai-structural-solutions/", source:"MIT Technology Review", published:"Sep 2021", keywords:["structural racism","ai systems","systemic change"], readingMinutes:9, theme:"Critical Computing", type:"essay" },
  { id:"ac1",  title:"Concrete Problems in AI Safety", url:"https://arxiv.org/abs/1606.06565", source:"Amodei et al.", published:"Jun 2016", keywords:["reward hacking","safe exploration","scalable oversight"], readingMinutes:40, theme:"AI Safety", year:"2016", type:"foundational" },
  { id:"ac2",  title:"Fairness and Abstraction in Sociotechnical Systems", url:"https://dl.acm.org/doi/10.1145/3287560.3287598", source:"Selbst et al.", published:"Jan 2019", keywords:["algorithmic fairness","sociotechnical systems","abstraction"], readingMinutes:35, theme:"Bias and Fairness", year:"2019", type:"foundational" },
  { id:"ac3",  title:"On the Dangers of Stochastic Parrots", url:"https://dl.acm.org/doi/10.1145/3442188.3445922", source:"Bender, Gebru et al.", published:"Mar 2021", keywords:["language model risks","environmental cost","value alignment"], readingMinutes:38, theme:"Ethics", year:"2021", type:"foundational" },
  { id:"ac4",  title:"Decolonial AI: Decolonial Theory as Sociotechnical Foresight", url:"https://link.springer.com/article/10.1007/s13347-020-00405-8", source:"Mohamed et al.", published:"Jun 2020", keywords:["decolonial theory","power","ai ethics"], readingMinutes:35, theme:"Critical Computing", year:"2020", type:"foundational" },
  { id:"ac5",  title:"Risks from Learned Optimization in Advanced Machine Learning", url:"https://arxiv.org/abs/1906.01820", source:"Hubinger et al.", published:"Jun 2019", keywords:["mesa-optimisation","deceptive alignment","inner alignment"], readingMinutes:45, theme:"AI Safety", year:"2019", type:"foundational" },
  { id:"ac6",  title:"Datasheets for Datasets", url:"https://arxiv.org/abs/1803.09010", source:"Gebru et al.", published:"Mar 2018", keywords:["dataset documentation","transparency","accountability"], readingMinutes:28, theme:"Bias and Fairness", year:"2021", type:"foundational" },
  { id:"ac7",  title:"Reward is Enough", url:"https://www.sciencedirect.com/science/article/pii/S0004370221000862", source:"Silver et al.", published:"Jun 2021", keywords:["reward maximisation","general intelligence","agency"], readingMinutes:35, theme:"AI Safety", year:"2021", type:"foundational" },
  { id:"ac8",  title:"Model Cards for Model Reporting", url:"https://arxiv.org/abs/1810.03993", source:"Mitchell et al.", published:"Oct 2018", keywords:["model cards","transparency","documentation"], readingMinutes:22, theme:"Ethics", year:"2019", type:"foundational" },
  { id:"ac9",  title:"Big Data's Disparate Impact", url:"https://doi.org/10.2139/ssrn.2477899", source:"Barocas and Selbst", published:"Apr 2016", keywords:["big data","discrimination","legal frameworks"], readingMinutes:30, theme:"Bias and Fairness", year:"2016", type:"foundational" },
  { id:"ac10", title:"Specification Gaming: The Flip Side of AI Ingenuity", url:"https://arxiv.org/abs/2001.09768", source:"Krakovna et al.", published:"Jan 2020", keywords:["specification gaming","reward misalignment","examples"], readingMinutes:25, theme:"AI Safety", year:"2020", type:"foundational" },
  { id:"ac11", title:"Value Alignment or Misalignment — What Will Keep AI Safe?", url:"https://arxiv.org/abs/1811.07871", source:"Russell et al.", published:"Nov 2018", keywords:["value alignment","corrigibility","human preferences"], readingMinutes:30, theme:"AI Safety", year:"2018", type:"foundational" },
  { id:"ac12", title:"The Ethics of Artificial Intelligence", url:"https://www.nickbostrom.com/ethics/artificial-intelligence.pdf", source:"Bostrom and Cirkovic", published:"Jan 2014", keywords:["superintelligence","moral status","long-run risks"], readingMinutes:40, theme:"Ethics", year:"2014", type:"foundational" },
  { id:"ac13", title:"Interpretable Machine Learning", url:"https://arxiv.org/abs/1901.04592", source:"Molnar", published:"Jan 2019", keywords:["interpretability","explainability","black box"], readingMinutes:50, theme:"Bias and Fairness", year:"2019", type:"foundational" },
  { id:"ac14", title:"A Unified Approach to Interpreting Model Predictions (SHAP)", url:"https://arxiv.org/abs/1705.07874", source:"Lundberg and Lee", published:"May 2017", keywords:["shap values","feature importance","model explanation"], readingMinutes:30, theme:"Bias and Fairness", year:"2017", type:"foundational" },
  { id:"ac16", title:"A Survey of Safety and Trustworthiness of Large Language Models", url:"https://arxiv.org/abs/2305.11391", source:"Huang et al.", published:"May 2023", keywords:["llm safety","trustworthiness","red teaming"], readingMinutes:50, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac17", title:"Constitutional AI: Harmlessness from AI Feedback", url:"https://arxiv.org/abs/2212.08073", source:"Bai et al.", published:"Dec 2022", keywords:["rlhf","harmlessness","constitutional ai"], readingMinutes:40, theme:"AI Safety", year:"2022", type:"recent" },
  { id:"ac18", title:"Toward a Critical Race Theory of Algorithmic Systems", url:"https://dl.acm.org/doi/10.1145/3531146.3533170", source:"Benjamin", published:"Jun 2022", keywords:["critical race theory","algorithms","structural racism"], readingMinutes:30, theme:"Bias and Fairness", year:"2022", type:"recent" },
  { id:"ac19", title:"Computing Power and the Governance of Artificial Intelligence", url:"https://arxiv.org/abs/2402.08797", source:"Heim et al.", published:"Feb 2024", keywords:["compute governance","chip controls","export policy"], readingMinutes:35, theme:"Governance", year:"2024", type:"recent" },
  { id:"ac20", title:"Predictability and Surprise in Large Generative Models", url:"https://arxiv.org/abs/2202.07785", source:"Ganguli et al.", published:"Feb 2022", keywords:["emergent capabilities","scaling","unpredictability"], readingMinutes:30, theme:"AI Safety", year:"2022", type:"recent" },
  { id:"ac21", title:"The Social and Environmental Impacts of AI in the Global South", url:"https://arxiv.org/abs/2306.16338", source:"Sambasivan et al.", published:"Jun 2023", keywords:["global south","data colonialism","environmental justice"], readingMinutes:32, theme:"Critical Computing", year:"2023", type:"recent" },
  { id:"ac22", title:"Measuring the Carbon Intensity of AI in Cloud Instances", url:"https://arxiv.org/abs/2206.05229", source:"Dodge et al.", published:"Jun 2022", keywords:["carbon intensity","cloud computing","ai emissions"], readingMinutes:28, theme:"Environment", year:"2022", type:"recent" },
  { id:"ac23", title:"Evaluating Language Models for Dangerous Capabilities", url:"https://arxiv.org/abs/2403.13793", source:"Anthropic", published:"Mar 2024", keywords:["capability evaluation","dangerous tasks","red teaming"], readingMinutes:35, theme:"AI Safety", year:"2024", type:"recent" },
  { id:"ac24", title:"An Overview of Catastrophic AI Risks", url:"https://arxiv.org/abs/2306.12001", source:"Hendrycks et al.", published:"Jun 2023", keywords:["catastrophic risk","misuse","structural risks"], readingMinutes:38, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac25", title:"Sparks of Artificial General Intelligence: GPT-4 Experiments", url:"https://arxiv.org/abs/2303.12528", source:"Bubeck et al.", published:"Mar 2023", keywords:["agi","gpt-4","reasoning"], readingMinutes:60, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac26", title:"Towards a Framework for AI Transparency", url:"https://arxiv.org/abs/2312.02213", source:"Bommasani et al.", published:"Dec 2023", keywords:["transparency","foundation models","disclosure"], readingMinutes:30, theme:"Governance", year:"2023", type:"recent" },
  { id:"ac27", title:"The ROOTS Search Tool: Data Governance for LLMs", url:"https://arxiv.org/abs/2302.14035", source:"Piktus et al.", published:"Feb 2023", keywords:["data governance","training data","llm transparency"], readingMinutes:25, theme:"Ethics", year:"2023", type:"recent" },
  { id:"ac28", title:"Preventing Discrimination from AI in Hiring", url:"https://arxiv.org/abs/2305.04412", source:"Raghavan et al.", published:"May 2023", keywords:["hiring discrimination","fairness","legal compliance"], readingMinutes:28, theme:"Bias and Fairness", year:"2023", type:"recent" },
  { id:"ac29", title:"Power-Seeking Can Be Dangerous and Instrumental", url:"https://arxiv.org/abs/1912.01683", source:"Turner et al.", published:"Dec 2019", keywords:["power seeking","instrumental convergence","corrigibility"], readingMinutes:32, theme:"AI Safety", year:"2021", type:"recent" },
  { id:"ac30", title:"Governing AI: Understanding the Limits of Ethics Codes", url:"https://doi.org/10.1145/3351095.3372873", source:"Mittelstadt", published:"Jan 2019", keywords:["ai ethics codes","self-regulation","limits"], readingMinutes:28, theme:"Governance", year:"2019", type:"recent" },
  { id:"ac31", title:"Algorithmic Impact Assessments and Accountability", url:"https://arxiv.org/abs/1912.09912", source:"Reisman et al.", published:"Dec 2019", keywords:["impact assessment","accountability","audit"], readingMinutes:30, theme:"Governance", year:"2019", type:"recent" },
  { id:"ac32", title:"Energy and Policy Considerations for Deep Learning in NLP", url:"https://arxiv.org/abs/1906.02629", source:"Strubell et al.", published:"Jun 2019", keywords:["nlp energy","carbon footprint","compute costs"], readingMinutes:25, theme:"Environment", year:"2019", type:"recent" },
  { id:"ac33", title:"Quantifying the Carbon Emissions of Machine Learning", url:"https://arxiv.org/abs/1910.09700", source:"Lacoste et al.", published:"Oct 2019", keywords:["carbon tracker","ml emissions","reporting"], readingMinutes:22, theme:"Environment", year:"2019", type:"recent" },
  { id:"ac34", title:"Participatory Approaches to Machine Learning", url:"https://arxiv.org/abs/2012.04071", source:"Birhane et al.", published:"Dec 2020", keywords:["participatory design","community input","ml governance"], readingMinutes:28, theme:"Critical Computing", year:"2020", type:"recent" },
  { id:"ac35", title:"The Values Encoded in Machine Learning Research", url:"https://arxiv.org/abs/2106.15590", source:"Birhane et al.", published:"Jun 2021", keywords:["research values","ml culture","implicit assumptions"], readingMinutes:30, theme:"Ethics", year:"2022", type:"recent" },
  { id:"ac37", title:"Harms of AI and the Duty to Prevent Them", url:"https://arxiv.org/abs/2202.07025", source:"Weidinger et al.", published:"Feb 2022", keywords:["ai harms taxonomy","risk framework","duty of care"], readingMinutes:35, theme:"Ethics", year:"2022", type:"recent" },
  { id:"ac38", title:"Do Large Language Models Know What They Don't Know?", url:"https://arxiv.org/abs/2305.18153", source:"Kadavath et al.", published:"May 2023", keywords:["calibration","uncertainty","epistemic honesty"], readingMinutes:28, theme:"AI Safety", year:"2023", type:"recent" },
  { id:"ac40", title:"Data Feminism", url:"https://doi.org/10.7551/mitpress/11805.001.0001", source:"D'Ignazio and Klein", published:"Mar 2020", keywords:["feminist data science","power in data","intersectionality"], readingMinutes:40, theme:"Digital Justice", year:"2020", type:"recent" },
  { id:"ac41", title:"AI and Human Rights", url:"https://arxiv.org/abs/1912.05848", source:"Raso et al.", published:"Dec 2019", keywords:["human rights framework","ai accountability","legal standards"], readingMinutes:30, theme:"Governance", year:"2019", type:"recent" },
  { id:"ac42", title:"Participatory Design for Fairness", url:"https://dl.acm.org/doi/10.1145/3351095.3372873", source:"Lee et al.", published:"Jan 2019", keywords:["participatory design","fairness","co-design"], readingMinutes:26, theme:"Bias and Fairness", year:"2019", type:"recent" },
  { id:"ac43", title:"Language Models (Mostly) Know What They Know", url:"https://arxiv.org/abs/2207.05221", source:"Kadavath et al.", published:"Jul 2022", keywords:["self-knowledge","calibration","language models"], readingMinutes:28, theme:"AI Safety", year:"2022", type:"recent" },
  { id:"ac44", title:"Ethical and Social Risks of Harm from Language Models", url:"https://arxiv.org/abs/2112.04359", source:"Weidinger et al.", published:"Dec 2021", keywords:["llm risks","social harm","ethics taxonomy"], readingMinutes:32, theme:"Ethics", year:"2021", type:"recent" },
];

// ─── Shared tiny components ───────────────────────────────────────────────────

const F = { fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" };

function Pill({ children, color, small }) {
  return <span style={{ fontSize: small?"10.5px":"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 7px", borderRadius:"2px", background:color+"22", color, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}

const TABS = [
  { id:"dispatch", label:"The Plot",  icon:"🌱" },
  { id:"garden",   label:"The Grove", icon:"🌿" },
  { id:"paths",    label:"Trails",    icon:"🗺️" },
  { id:"field",    label:"The Field", icon:"🏛️" },
  { id:"stats",    label:"Harvest",   icon:"🌾" },
  { id:"add",      label:"Sow",       icon:"＋" },
];

const TAB_SUBTITLES = {
  garden: "Network of knowledge, ideas, and theories",
  paths:  "Theme specific curriculum for the intellectually curious",
  field:  "Actors shaping the discourse",
};

function TabBar({ active, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, height:"100%" }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ ...F, height:"100%", padding:"0 20px", background:"transparent", border:"none", borderBottom: active===t.id ? "2px solid #C2410C":"2px solid transparent", color: active===t.id ? "#1C1410":"#B45309", fontSize:"12.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", transition:"color 0.15s" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function BottomTabBar({ active, onChange }) {
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, height:"56px", background:"#FAFAF8", borderTop:"1px solid rgba(194,65,12,0.35)", display:"flex", zIndex:200, backdropFilter:"blur(8px)" }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ flex:1, background:"transparent", border:"none", borderTop: active===t.id ? "2px solid #C2410C" : "2px solid transparent", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"2px", cursor:"pointer", color: active===t.id ? "#1C1410" : "#B45309", transition:"color 0.15s", padding:0 }}>
          <span style={{ fontSize:"17.5px", lineHeight:1 }}>{t.icon}</span>
          <span style={{ ...F, fontSize:"10.5px", letterSpacing:"0.08em", textTransform:"uppercase" }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Notes modal ──────────────────────────────────────────────────────────────

function NotesModal({ item, notes, onSave, onClose }) {
  const existing = notes[item.url] || { argument:"", thoughts:"", quote:"" };
  const [arg, setArg]     = useState(existing.argument);
  const [tho, setTho]     = useState(existing.thoughts);
  const [quo, setQuo]     = useState(existing.quote || "");
  const c = COLOR[item.theme] || "#B45309";
  const hasContent = arg.trim() || tho.trim() || quo.trim();

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(10,30,20,0.65)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...F, background:"#FFFFFF", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"6px", width:"100%", maxWidth:"540px", maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid rgba(194,65,12,0.50)", display:"flex", alignItems:"flex-start", gap:"10px" }}>
          <div style={{ flex:1 }}>
            <Pill color={c}>{item.theme}</Pill>
            <div style={{ fontSize:"14.5px", color:"#1C1410", marginTop:"7px", lineHeight:1.4, fontWeight:500 }}>{item.title}</div>
            <div style={{ fontSize:"12.5px", color:"#1C1410", fontStyle:"italic", marginTop:"3px" }}>{item.source} · {item.published}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#1C1410", cursor:"pointer", fontSize:"19.5px", flexShrink:0 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:"14px" }}>
          <div>
            <label style={{ fontSize:"11.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase", display:"block", marginBottom:"6px" }}>Key quote</label>
            <textarea value={quo} onChange={e => setQuo(e.target.value)} placeholder="Paste a passage worth keeping…" rows={3}
              style={{ ...F, width:"100%", background:"rgba(250,250,248,0.97)", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", color:"#1C1410", fontSize:"13.5px", padding:"9px 11px", resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6, fontStyle:"italic" }} />
          </div>
          <div>
            <label style={{ fontSize:"11.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase", display:"block", marginBottom:"6px" }}>What is being argued?</label>
            <textarea value={arg} onChange={e => setArg(e.target.value)} placeholder="Summarise the core argument…" rows={4}
              style={{ ...F, width:"100%", background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", color:"#1C1410", fontSize:"13.5px", padding:"9px 11px", resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }} />
          </div>
          <div>
            <label style={{ fontSize:"11.5px", color:"#1C1410", letterSpacing:"0.12em", textTransform:"uppercase", display:"block", marginBottom:"6px" }}>My thoughts / response</label>
            <textarea value={tho} onChange={e => setTho(e.target.value)} placeholder="Your reaction, critique, connections to other ideas…" rows={5}
              style={{ ...F, width:"100%", background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", color:"#1C1410", fontSize:"13.5px", padding:"9px 11px", resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }} />
          </div>
        </div>
        <div style={{ padding:"12px 18px", borderTop:"1px solid rgba(74,96,48,0.14)", display:"flex", gap:"8px", justifyContent:"flex-end" }}>
          {hasContent && <button onClick={() => { onSave(item.url, null); onClose(); }} style={{ ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.55)", color:"#C2410C", padding:"6px 14px", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Delete note</button>}
          <button onClick={onClose} style={{ ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.50)", color:"#B45309", padding:"6px 14px", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Cancel</button>
          <button onClick={() => { onSave(item.url, { argument:arg, thoughts:tho, quote:quo }); onClose(); }} style={{ ...F, background:"transparent", border:"1px solid #C2410C", color:"#C2410C", padding:"6px 14px", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Save note</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dispatch item row ────────────────────────────────────────────────────────

const DISPATCH_WAVE = "M0,5 Q45,1 90,5 Q135,9 180,5 Q225,1 270,5 Q315,9 360,5 Q405,1 450,5 Q495,9 540,5";

function DispatchItem({ item, show, idx, isLast, waveColor, isOpen, readItems, onToggleRead, notes, onOpenSidebar }) {
  const c = COLOR[item.theme] || "#B45309";
  const isRead = readItems.has(item.url);
  const hasNote = !!(notes[item.url]?.argument || notes[item.url]?.thoughts || notes[item.url]?.quote);
  return (
    <Fragment>
      <div onClick={() => onOpenSidebar(item)}
        style={{ opacity:show?(isRead?0.42:1):0, transform:show?"none":"translateY(8px)", transition:`opacity 0.35s ease ${idx*0.06}s, transform 0.35s ease ${idx*0.06}s`, padding:"20px 0 4px", cursor:"pointer" }}>
        <div style={{ display:"flex", gap:"7px", flexWrap:"wrap", alignItems:"center", marginBottom:"7px" }}>
          <Pill color={c}>{item.theme}</Pill>
          {item.type==="foundational" && <Pill color="#C2410C">Foundational</Pill>}
          {item.custom && <Pill color="#A78BFA">Custom</Pill>}
          <span style={{ fontSize:"11.5px", color:"#1C1410" }}>{item.published}</span>
        </div>
        <div style={{ fontSize:"14.5px", color: isOpen ? c : "#1C1410", textDecoration:isRead?"line-through":"none", textDecorationColor:"#444", lineHeight:"1.45", marginBottom:"10px", fontWeight:500, transition:"color 0.15s", ...F }}>
          {item.title} <span style={{ opacity:0.3, fontSize:"12px" }}>↗</span>
        </div>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", alignItems:"center", paddingBottom:"4px" }}>
          <span style={{ fontSize:"11px", color:"#B45309", fontStyle:"italic" }}>{item.source}</span>
          {item.keywords.slice(0,2).map((kw,j) => <span key={j} style={{ fontSize:"10px", color:"#C2410C", background:"rgba(217,119,6,0.12)", border:"1px solid rgba(217,119,6,0.28)", padding:"1px 5px", borderRadius:"2px" }}>#{kw}</span>)}
          <div style={{ marginLeft:"auto", display:"flex", gap:"4px", flexShrink:0 }}>
            {hasNote && <span style={{ fontSize:"9.5px", letterSpacing:"0.07em", textTransform:"uppercase", color:"#DB2777", padding:"2px 7px", background:"rgba(219,39,119,0.10)", border:"1px solid rgba(219,39,119,0.35)", borderRadius:"2px" }}>✎ Note</span>}
            <button onClick={e => { e.stopPropagation(); onToggleRead(item.url); }}
              style={{ ...F, background: isRead?"rgba(22,163,74,0.10)":"rgba(250,250,248,0.85)", border: isRead?"1px solid rgba(22,163,74,0.40)":"1px solid rgba(194,65,12,0.38)", borderRadius:"2px", padding:"2px 7px", cursor:"pointer", fontSize:"9.5px", letterSpacing:"0.07em", textTransform:"uppercase", color: isRead?"#16A34A":"#B45309" }}>
              {isRead ? "✓ Read" : "To Read"}
            </button>
          </div>
        </div>
      </div>
      {!isLast && (
        <svg width="100%" height="10" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d={DISPATCH_WAVE} fill="none" stroke={waveColor} strokeWidth="1" strokeOpacity="0.18"/>
        </svg>
      )}
    </Fragment>
  );
}

// ─── Dispatch view ────────────────────────────────────────────────────────────

function SectionHead({ label, sub, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"22px", minWidth:0 }}>
      <svg style={{ flex:1, minWidth:0 }} width="0" height="8" viewBox="0 0 540 10" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d={DISPATCH_WAVE} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
      </svg>
      <div style={{ textAlign:"center", flexShrink:0 }}>
        <div style={{ ...F, fontSize:"10px", letterSpacing:"0.22em", textTransform:"uppercase", fontWeight:600, color, whiteSpace:"nowrap" }}>{label}</div>
        <div style={{ ...F, fontSize:"10.5px", color:"#B45309", fontStyle:"italic", whiteSpace:"nowrap", marginTop:"2px" }}>{sub}</div>
      </div>
      <svg style={{ flex:1, minWidth:0 }} width="0" height="8" viewBox="0 0 540 10" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d={DISPATCH_WAVE} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
      </svg>
    </div>
  );
}

function DispatchView({ pool, readItems, onToggleRead, notes, onSaveNote, paths = [], orgs = [], orgLinks = [], onSavePath, onSaveOrgLink, onDeleteOrgLink, onRemove }) {
  const [date, setDate]         = useState(todayStr());
  const [issue, setIssue]       = useState(null);
  const [show, setShow]         = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerVal, setPickerVal]   = useState(todayStr());
  const [noteItem, setNoteItem]     = useState(null);
  const [sidebarItem, setSidebarItem] = useState(null);

  useEffect(() => {
    if (!issue) return;
    const poolUrls = new Set(pool.map(i => i.url));
    setIssue(prev => prev ? ({
      nonAcademic: prev.nonAcademic.filter(i => poolUrls.has(i.url)),
      academic:    prev.academic.filter(i => poolUrls.has(i.url)),
    }) : null);
  }, [pool]); // eslint-disable-line react-hooks/exhaustive-deps

  function load(d) {
    setShow(false);
    setDate(d);
    setIssue(getDispatch(d, pool));
    setSidebarItem(null);
    setTimeout(() => setShow(true), 60);
  }

  const isToday = date === todayStr();
  const allItems = issue ? [...issue.nonAcademic, ...issue.academic] : [];
  const readCount = allItems.filter(i => readItems.has(i.url)).length;

  const connectedTitles = useMemo(() => {
    if (!sidebarItem) return [];
    const kws = new Set(sidebarItem.keywords || []);
    return pool
      .filter(n => n.id !== sidebarItem.id && (n.keywords || []).some(k => kws.has(k)))
      .map(n => ({ ...n, keywords: (n.keywords || []).filter(k => kws.has(k)) }))
      .sort((a, b) => b.keywords.length - a.keywords.length)
      .slice(0, 12);
  }, [sidebarItem, pool]);

  return (
    <div style={{ position:"relative", height:"100%" }}>
    <div style={{ overflowY:"auto", height:"100%", ...F }}>
    <div style={{ maxWidth:"980px", margin:"0 auto", padding:"0 32px 80px" }}>
      {/* Date header */}
      <div style={{ paddingTop:"32px", paddingBottom:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
          <button onClick={() => load(prevDay(date))} style={NAV}>←</button>
          <button onClick={() => { setPickerVal(date); setShowPicker(v=>!v); }} style={{ ...F, background:"transparent", border:"none", cursor:"pointer", padding:"0 2px" }}>
            <span style={{ fontSize:"14.5px", color: isToday?"#C2410C":"#1C1410", fontStyle:"italic", borderBottom:"1px dashed currentColor", opacity:0.85 }}>{fmtDate(date)}</span>
          </button>
          <button onClick={() => { if(!isToday) load(nextDay(date)); }} style={{ ...NAV, opacity:isToday?0.2:1, cursor:isToday?"default":"pointer" }}>→</button>
          {!isToday && <button onClick={() => load(todayStr())} style={{ ...F, fontSize:"10.5px", letterSpacing:"0.12em", textTransform:"uppercase", background:"transparent", border:"1px solid rgba(194,65,12,0.55)", color:"#C2410C", padding:"3px 9px", borderRadius:"2px", cursor:"pointer" }}>Today</button>}
          {issue && <span style={{ fontSize:"12.5px", color:"#1C1410", marginLeft:"auto", fontStyle:"italic" }}>{readCount}/{allItems.length} read</span>}
        </div>

        {showPicker && (
          <div style={{ marginBottom:"16px", background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"4px", padding:"11px 14px", display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
            <span style={{ fontSize:"11.5px", color:"#1C1410", textTransform:"uppercase", letterSpacing:"0.1em" }}>Jump to</span>
            <input type="date" value={pickerVal} max={todayStr()} onChange={e=>setPickerVal(e.target.value)}
              style={{ background:"transparent", border:"1px solid rgba(194,65,12,0.50)", borderRadius:"3px", color:"#1C1410", padding:"4px 8px", fontSize:"13.5px", ...F }} />
            <button onClick={() => { if(pickerVal){load(pickerVal);setShowPicker(false);} }}
              style={{ ...F, background:"transparent", border:"1px solid #C2410C", color:"#C2410C", padding:"4px 12px", borderRadius:"3px", cursor:"pointer", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase" }}>Go</button>
            <button onClick={() => setShowPicker(false)} style={{ background:"transparent", border:"none", color:"#1C1410", cursor:"pointer", fontSize:"17.5px", marginLeft:"auto" }}>×</button>
          </div>
        )}

        {/* Theme pills */}
        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"20px" }}>
          {THEMES.map(t => <span key={t.name} style={{ fontSize:"10.5px", letterSpacing:"0.08em", textTransform:"uppercase", padding:"3px 7px", borderRadius:"2px", border:"1px solid "+t.color+"40", color:t.color+"99" }}>{t.name}</span>)}
        </div>

        {!issue && (
          <button onClick={() => load(date)} style={{ ...F, padding:"11px 26px", background:"transparent", border:"1px solid #C2410C", color:"#C2410C", fontSize:"12.5px", letterSpacing:"0.15em", textTransform:"uppercase", cursor:"pointer", borderRadius:"3px" }}>
            Generate Today's Plot
          </button>
        )}
      </div>

      {issue && (
        <>
          {/* Progress bar */}
          <div style={{ height:"2px", background:"rgba(194,65,12,0.25)", borderRadius:"1px", marginBottom:"32px", overflow:"hidden", opacity:show?1:0, transition:"opacity 0.4s ease 0.2s" }}>
            <div style={{ height:"100%", width:`${allItems.length?(readCount/allItems.length)*100:0}%`, background:"#16A34A", transition:"width 0.5s", borderRadius:"1px" }} />
          </div>

          {/* Two-column layout */}
          <div style={{ position:"relative" }}>
            {/* Center rule */}
            <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:"1px", background:"linear-gradient(to bottom, transparent 0%, rgba(194,65,12,0.18) 8%, rgba(194,65,12,0.18) 92%, transparent 100%)", pointerEvents:"none" }} />

            {/* Column headers */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 56px", marginBottom:"8px" }}>
              <SectionHead label="I — In the Field"   sub="Essays · Reports · Journalism" color="#C2410C" />
              <SectionHead label="II — The Literature" sub="Papers · Foundational works"   color="#1068D4" />
            </div>

            {/* Items */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 56px" }}>
              <div style={{ minWidth:0 }}>
                {issue.nonAcademic.map((item,i) => (
                  <DispatchItem key={item.url} item={item} show={show} idx={i}
                    isLast={i === issue.nonAcademic.length - 1}
                    waveColor="#C2410C"
                    isOpen={sidebarItem?.id === item.id}
                    readItems={readItems} onToggleRead={onToggleRead} notes={notes}
                    onOpenSidebar={it => setSidebarItem(prev => prev?.id === it.id ? null : it)} />
                ))}
              </div>
              <div style={{ minWidth:0 }}>
                {issue.academic.map((item,i) => (
                  <DispatchItem key={item.url} item={item} show={show} idx={i}
                    isLast={i === issue.academic.length - 1}
                    waveColor="#1068D4"
                    isOpen={sidebarItem?.id === item.id}
                    readItems={readItems} onToggleRead={onToggleRead} notes={notes}
                    onOpenSidebar={it => setSidebarItem(prev => prev?.id === it.id ? null : it)} />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop:"44px", paddingTop:"14px", borderTop:"1px solid rgba(194,65,12,0.20)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"8px", opacity:show?1:0, transition:"opacity 0.4s ease 0.6s" }}>
            <span style={{ fontSize:"11.5px", color:"#B45309", fontStyle:"italic" }}>{pool.length} items in pool · rotates daily</span>
            <button onClick={() => load(date)} style={{ ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.38)", color:"#B45309", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", padding:"4px 11px", cursor:"pointer", borderRadius:"2px" }}>Reshuffle</button>
          </div>
        </>
      )}

      {noteItem && <NotesModal item={noteItem} notes={notes} onSave={onSaveNote} onClose={() => setNoteItem(null)} />}
    </div>
    </div>
    {sidebarItem && (
      <GardenSidebar
        node={sidebarItem}
        onClose={() => setSidebarItem(null)}
        readItems={readItems}
        onToggleRead={onToggleRead}
        notes={notes}
        onOpenNote={it => { setSidebarItem(null); setNoteItem(it); }}
        connectedTitles={connectedTitles}
        onNavigate={null}
        publicMode={false}
        onRemove={onRemove ? it => { onRemove(it); setSidebarItem(null); } : null}
        paths={paths}
        onSavePath={onSavePath || (() => {})}
        orgs={orgs}
        orgLinks={orgLinks}
        onSaveOrgLink={onSaveOrgLink || (() => {})}
        onDeleteOrgLink={onDeleteOrgLink || (() => {})}
      />
    )}
    </div>
  );
}

// ─── Add Source view ──────────────────────────────────────────────────────────

function AddSourceView({ pool, onAdd, onDelete, hiddenIds, allBuiltin, onHide, onRestore, onSaveThemeColor }) {
  const allKeywords = useMemo(() => {
    const s = new Set();
    pool.forEach(p => p.keywords.forEach(k => s.add(k)));
    return [...s].sort();
  }, [pool]);

  const [form, setForm] = useState({ title:"", url:"", source:"", published:"", readingMinutes:"", theme:THEMES[0].name, customTheme:"", themeColor:CUSTOM_PALETTE[0], type:"essay", year:"", keywords:[] });
  const [kwInput, setKwInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  function addKw(kw) {
    const clean = kw.trim().toLowerCase();
    if(clean && !form.keywords.includes(clean)) set("keywords",[...form.keywords, clean]);
    setKwInput("");
  }

  const resolvedTheme = form.theme === "__other__" ? form.customTheme.trim() : form.theme;

  function validate() {
    const e = {};
    if(!form.title.trim()) e.title = "Required";
    if(!form.url.trim()) e.url = "Required";
    if(!form.source.trim()) e.source = "Required";
    if(!form.published.trim()) e.published = "Required";
    if(form.theme === "__other__" && !form.customTheme.trim()) e.customTheme = "Enter a theme name";
    if(form.keywords.length === 0) e.keywords = "Add at least one keyword";
    return e;
  }

  function submit() {
    const e = validate();
    if(Object.keys(e).length) { setErrors(e); return; }
    const newItem = {
      id: "custom_" + Date.now(),
      title: form.title.trim(),
      url: form.url.trim(),
      source: form.source.trim(),
      published: form.published.trim(),
      readingMinutes: parseInt(form.readingMinutes),
      theme: resolvedTheme,
      type: form.type,
      year: form.type !== "essay" ? form.year : undefined,
      keywords: form.keywords,
      custom: true,
    };
    if (form.theme === "__other__" && resolvedTheme) onSaveThemeColor?.(resolvedTheme, form.themeColor);
    onAdd(newItem);
    setForm({ title:"", url:"", source:"", published:"", readingMinutes:"", theme:THEMES[0].name, customTheme:"", themeColor:CUSTOM_PALETTE[0], type:"essay", year:"", keywords:[] });
    setErrors({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const customItems = pool.filter(p => p.custom);
  const inputStyle = { ...F, width:"100%", background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", color:"#1C1410", fontSize:"13.5px", padding:"8px 10px", outline:"none", boxSizing:"border-box" };
  const labelStyle = { fontSize:"11.5px", color:"#B45309", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:"5px" };
  const errStyle   = { fontSize:"11.5px", color:"#C2410C", marginTop:"3px" };

  return (
    <div style={{ ...F, maxWidth:"680px", margin:"0 auto", padding:"24px 24px 80px" }}>
      <div style={{ marginBottom:"28px" }}>
        <h2 style={{ fontSize:"19.5px", color:"#1C1410", fontWeight:400, margin:"0 0 6px", letterSpacing:"-0.01em" }}>Sow a Source</h2>
        <p style={{ fontSize:"13.5px", color:"#B45309", fontStyle:"italic", margin:0 }}>New sources enter the pool immediately and will appear in future plots and the grove.</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"14px" }}>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={labelStyle}>Title *</label>
          <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Full title of the piece" style={inputStyle} />
          {errors.title && <div style={errStyle}>{errors.title}</div>}
        </div>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={labelStyle}>URL *</label>
          <input value={form.url} onChange={e=>set("url",e.target.value)} placeholder="https://..." style={inputStyle} />
          {errors.url && <div style={errStyle}>{errors.url}</div>}
        </div>
        <div>
          <label style={labelStyle}>Source / Author *</label>
          <input value={form.source} onChange={e=>set("source",e.target.value)} placeholder="e.g. The Markup, Gebru et al." style={inputStyle} />
          {errors.source && <div style={errStyle}>{errors.source}</div>}
        </div>
        <div>
          <label style={labelStyle}>Published *</label>
          <input value={form.published} onChange={e=>set("published",e.target.value)} placeholder="e.g. Mar 2024" style={inputStyle} />
          {errors.published && <div style={errStyle}>{errors.published}</div>}
        </div>
        <div>
          <label style={labelStyle}>Theme *</label>
          <select value={form.theme} onChange={e=>set("theme",e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
            {THEMES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            <option value="__other__">Other / New theme…</option>
          </select>
          {form.theme === "__other__" && (<>
            <input value={form.customTheme} onChange={e=>set("customTheme",e.target.value)}
              placeholder="Name your theme" style={{ ...inputStyle, marginTop:"6px" }} />
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginTop:"6px" }}>
              <input type="color" value={form.themeColor} onChange={e=>set("themeColor",e.target.value)}
                style={{ width:"34px", height:"32px", padding:"2px 3px", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", cursor:"pointer", background:"none" }} />
              <span style={{ ...F, fontSize:"11.5px", color:"#B45309" }}>Colour for this theme in the grove</span>
            </div>
          </>)}
          {errors.customTheme && <div style={errStyle}>{errors.customTheme}</div>}
        </div>
        <div>
          <label style={labelStyle}>Type *</label>
          <select value={form.type} onChange={e=>set("type",e.target.value)} style={{ ...inputStyle, cursor:"pointer" }}>
            <option value="essay">Essay / Article / Report</option>
            <option value="recent">Academic — Recent paper</option>
            <option value="foundational">Academic — Foundational</option>
          </select>
        </div>
        {form.type !== "essay" && (
          <div>
            <label style={labelStyle}>Year</label>
            <input value={form.year} onChange={e=>set("year",e.target.value)} placeholder="e.g. 2023" style={inputStyle} />
          </div>
        )}
      </div>

      {/* Keywords */}
      <div style={{ marginBottom:"20px" }}>
        <label style={labelStyle}>Keywords * (3 recommended)</label>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"8px" }}>
          {form.keywords.map((kw,i) => (
            <span key={i} style={{ fontSize:"12.5px", color:"#C2410C", background:"rgba(194,65,12,0.28)", border:"1px solid rgba(194,65,12,0.55)", padding:"2px 8px", borderRadius:"2px", display:"flex", alignItems:"center", gap:"5px" }}>
              #{kw}
              <button onClick={() => set("keywords",form.keywords.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:"#C2410C", cursor:"pointer", fontSize:"12.5px", padding:0, lineHeight:1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <input value={kwInput} onChange={e=>setKwInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){ e.preventDefault(); addKw(kwInput); }}}
            placeholder="Type a keyword and press Enter" style={{ ...inputStyle, flex:1 }} list="kw-suggestions" />
          <datalist id="kw-suggestions">{allKeywords.map(k=><option key={k} value={k}/>)}</datalist>
          <button onClick={() => addKw(kwInput)} style={{ ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.50)", color:"#B45309", padding:"0 14px", borderRadius:"3px", cursor:"pointer", fontSize:"12.5px", whiteSpace:"nowrap" }}>Add</button>
        </div>
        <div style={{ fontSize:"11.5px", color:"#B45309", marginTop:"5px" }}>Pick from existing or type new ones. Shared keywords create edges in the Grove.</div>
        {errors.keywords && <div style={errStyle}>{errors.keywords}</div>}
      </div>

      <button onClick={submit} style={{ ...F, padding:"10px 28px", background:"transparent", border:"1px solid #C2410C", color:"#C2410C", fontSize:"12.5px", letterSpacing:"0.15em", textTransform:"uppercase", cursor:"pointer", borderRadius:"3px", marginBottom:"8px" }}>
        Add to Pool
      </button>
      {saved && <span style={{ fontSize:"12.5px", color:"#16A34A", marginLeft:"12px" }}>✓ Added successfully</span>}

      {/* Custom items list */}
      {customItems.length > 0 && (
        <div style={{ marginTop:"36px" }}>
          <div style={{ fontSize:"11.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"14px" }}>Your custom sources ({customItems.length})</div>
          {customItems.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"flex-start", gap:"12px", borderBottom:"1px solid rgba(194,65,12,0.42)", paddingBottom:"12px", marginBottom:"12px" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", gap:"5px", marginBottom:"4px" }}>
                  <Pill color={COLOR[item.theme]||"#B45309"}>{item.theme}</Pill>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:"13.5px", color:"#1C1410", textDecoration:"none", display:"block", marginBottom:"3px" }}>{item.title} ↗</a>
                <div style={{ fontSize:"12.5px", color:"#1C1410", fontStyle:"italic" }}>{item.source} · {item.published}</div>
              </div>
              <button onClick={() => onDelete(item.id)} style={{ ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.42)", color:"#C2410C", padding:"3px 9px", borderRadius:"3px", cursor:"pointer", fontSize:"10.5px", letterSpacing:"0.1em", textTransform:"uppercase", flexShrink:0 }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden built-in sources */}
      {hiddenIds?.size > 0 && (
        <div style={{ marginTop:"36px" }}>
          <div style={{ fontSize:"11.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"14px" }}>Hidden sources ({hiddenIds.size}) — click Restore to bring back</div>
          {(allBuiltin || []).filter(item => hiddenIds.has(item.id)).map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"flex-start", gap:"12px", borderBottom:"1px solid rgba(194,65,12,0.42)", paddingBottom:"10px", marginBottom:"10px", opacity:0.6 }}>
              <div style={{ flex:1 }}>
                <Pill color={COLOR[item.theme]||"#B45309"}>{item.theme}</Pill>
                <div style={{ fontSize:"12.5px", color:"#1C1410", marginTop:"4px" }}>{item.title}</div>
                <div style={{ fontSize:"12.5px", color:"#1C1410", fontStyle:"italic", marginTop:"2px" }}>{item.source} · {item.published}</div>
              </div>
              <button onClick={() => onRestore(item.id)} style={{ ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.50)", color:"#B45309", padding:"3px 9px", borderRadius:"3px", cursor:"pointer", fontSize:"10.5px", letterSpacing:"0.1em", textTransform:"uppercase", flexShrink:0 }}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Garden / graph view ──────────────────────────────────────────────────────

function buildLinks(items) {
  const kwMap = {};
  items.forEach(n => n.keywords.forEach(kw => { if(!kwMap[kw]) kwMap[kw]=[]; kwMap[kw].push(n.id); }));
  const links = [];
  const seen = new Set();
  Object.entries(kwMap).forEach(([kw,ids]) => {
    for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++) {
      const key = [ids[i],ids[j]].sort().join("||");
      const ex = links.find(l => [l.source,l.target].sort().join("||")===key);
      if(ex) ex.keywords.push(kw); else { seen.add(key); links.push({source:ids[i],target:ids[j],keywords:[kw]}); }
    }
  });
  return links;
}

function GardenSidebar({ node, onClose, readItems, onToggleRead, notes, onOpenNote, connectedTitles, onNavigate, publicMode, onRemove, paths, onSavePath, orgs, orgLinks, onSaveOrgLink, onDeleteOrgLink }) {
  if(!node) return null;
  const c = COLOR[node.theme]||"#B45309";
  const isRead = readItems.has(node.url);
  const hasNote = !!(notes[node.url]?.argument||notes[node.url]?.thoughts||notes[node.url]?.quote);
  const noteData = notes[node.url];
  return (
    <div style={{ ...F, position:"absolute", top:0, right:0, bottom:0, width:"290px", background:"rgba(250,250,248,1.0)", borderLeft:"1px solid rgba(194,65,12,0.42)", zIndex:30, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"14px 16px 12px", borderBottom:"1px solid rgba(194,65,12,0.50)", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"8px" }}>
        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
          <Pill color={c}>{node.theme}</Pill>
          {node.type==="foundational" && <Pill color="#C2410C">Foundational</Pill>}
          {node.custom && <Pill color="#A78BFA">Custom</Pill>}
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#1C1410", cursor:"pointer", fontSize:"19.5px", lineHeight:1, flexShrink:0 }}>×</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
        <a href={node.url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize:"15.5px", color:"#1C1410", lineHeight:"1.4", marginBottom:"8px", fontWeight:500, display:"block", textDecoration:"none", transition:"color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color=c}
          onMouseLeave={e => e.currentTarget.style.color="#1C1410"}>
          {node.title} <span style={{ opacity:0.3, fontSize:"12px" }}>↗</span>
        </a>
        <div style={{ fontSize:"12.5px", color:"#1C1410", fontStyle:"italic", marginBottom:"3px" }}>{node.source}</div>
        <div style={{ fontSize:"11.5px", color:"#1C1410", marginBottom:"12px" }}>{node.published}</div>
        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"14px" }}>
          {node.keywords.map((kw,i) => <span key={i} style={{ fontSize:"11.5px", color:c, background:c+"14", border:"1px solid "+c+"30", padding:"2px 7px", borderRadius:"2px" }}>#{kw}</span>)}
        </div>

        {/* Notes preview */}
        {hasNote && (
          <div style={{ background:"rgba(194,65,12,0.15)", border:"1px solid rgba(194,65,12,0.40)", borderRadius:"3px", padding:"10px 12px", marginBottom:"12px", display:"flex", flexDirection:"column", gap:"8px" }}>
            {noteData.quote && <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.6, fontStyle:"italic", borderLeft:"2px solid rgba(219,39,119,0.55)", paddingLeft:"8px" }}><span style={{ fontSize:"10.5px", color:"#C2410C", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"3px", fontStyle:"normal" }}>Quote</span>{publicMode ? noteData.quote : (noteData.quote.slice(0,140)+(noteData.quote.length>140?"…":""))}</div>}
            {noteData.argument && <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.5 }}><span style={{ fontSize:"10.5px", color:"#C2410C", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"3px" }}>Argument</span>{publicMode ? noteData.argument : (noteData.argument.slice(0,120)+(noteData.argument.length>120?"…":""))}</div>}
            {noteData.thoughts && <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.5 }}><span style={{ fontSize:"10.5px", color:"#C2410C", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"3px" }}>My thoughts</span>{publicMode ? noteData.thoughts : (noteData.thoughts.slice(0,120)+(noteData.thoughts.length>120?"…":""))}</div>}
          </div>
        )}

        {connectedTitles.length > 0 && (
          <div>
            <div style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"7px" }}>
              Connected via shared keywords — <span style={{ fontStyle:"italic" }}>click to navigate</span>
            </div>
            {connectedTitles.slice(0,8).map((ct,i) => {
              const cc = COLOR[ct.theme] || "#B45309";
              return (
                <button key={i} onClick={() => onNavigate && onNavigate(ct.id)}
                  style={{ display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderLeft:"2px solid "+cc+"55", padding:"5px 0 5px 9px", marginBottom:"4px", cursor:"pointer", borderRadius:"0 3px 3px 0", transition:"background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = cc+"10"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ fontSize:"10.5px", color:cc, marginBottom:"2px", letterSpacing:"0.04em" }}>
                    #{ct.keywords.join(" · #")}
                  </div>
                  <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.4, ...F }}>
                    {ct.title.length>52 ? ct.title.slice(0,52)+"…" : ct.title}
                  </div>
                  <div style={{ fontSize:"11.5px", color:"#B45309", fontStyle:"italic", marginTop:"1px" }}>
                    {ct.source}
                  </div>
                </button>
              );
            })}
            {connectedTitles.length>8 && (
              <div style={{ fontSize:"11.5px", color:"#B45309", paddingLeft:"9px", marginTop:"4px", fontStyle:"italic" }}>
                +{connectedTitles.length-8} more connections
              </div>
            )}
          </div>
        )}

        {/* Reading paths */}
        {!publicMode && paths && (
          <div style={{ marginTop:"14px", paddingTop:"12px", borderTop:"1px solid rgba(194,65,12,0.22)" }}>
            <div style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"7px" }}>Trails</div>
            {paths.filter(p => (p.item_ids||[]).includes(node.id)).map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:"5px", marginBottom:"4px", background:p.color+"12", border:"1px solid "+p.color+"30", borderRadius:"3px", padding:"4px 7px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:p.color, flexShrink:0 }} />
                <span style={{ ...F, fontSize:"11.5px", color:"#1C1410", flex:1 }}>{p.name}</span>
                <span style={{ fontSize:"10.5px", color:p.color }}>#{(p.item_ids||[]).indexOf(node.id)+1}</span>
                <button onClick={() => onSavePath({...p, item_ids:(p.item_ids||[]).filter(id=>id!==node.id)})}
                  style={{ background:"none", border:"none", cursor:"pointer", color:p.color, fontSize:"13.5px", padding:0, lineHeight:1, opacity:0.7 }}>×</button>
              </div>
            ))}
            <PathSelector node={node} paths={paths} onSavePath={onSavePath} />
          </div>
        )}

        {/* Organisations */}
        {!publicMode && orgs && orgs.length > 0 && (
          <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid rgba(194,65,12,0.22)" }}>
            <div style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"7px" }}>Organisations</div>
            {orgs.filter(org => orgLinks.some(l => l.org_id === org.id && l.item_id === node.id)).map(org => {
              const color = STANCE_COLORS[org.stance] || "#B45309";
              return (
                <div key={org.id} style={{ display:"flex", alignItems:"center", gap:"5px", marginBottom:"4px", background:color+"10", border:"1px solid "+color+"25", borderRadius:"3px", padding:"4px 7px" }}>
                  <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:color, flexShrink:0 }} />
                  <span style={{ ...F, fontSize:"11.5px", color:"#1C1410", flex:1 }}>{org.name}</span>
                  <span style={{ fontSize:"10.5px", color }}>{org.stance.split(" / ")[0]}</span>
                  <button onClick={() => onDeleteOrgLink(org.id, node.id)} style={{ background:"none", border:"none", cursor:"pointer", color, fontSize:"13.5px", padding:0, lineHeight:1, opacity:0.7 }}>×</button>
                </div>
              );
            })}
            <OrgLinker node={node} orgs={orgs} orgLinks={orgLinks} onSaveOrgLink={onSaveOrgLink} onDeleteOrgLink={onDeleteOrgLink} />
          </div>
        )}
      </div>
      <div style={{ padding:"12px 14px", borderTop:"1px solid rgba(194,65,12,0.50)", display:"flex", gap:"5px", flexWrap:"wrap" }}>
        <a href={node.url} target="_blank" rel="noopener noreferrer" style={{ flex:1, textAlign:"center", padding:"7px 4px", background:"transparent", border:"1px solid "+c, color:c, borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", textDecoration:"none", ...F }}>Open ↗</a>
        {!publicMode && <button onClick={() => onOpenNote(node)} style={{ flex:1, padding:"7px 4px", background:hasNote?"rgba(219,39,119,0.18)":"transparent", border:hasNote?"1px solid rgba(219,39,119,0.50)":"1px solid rgba(194,65,12,0.42)", color:hasNote?"#DB2777":"#1C1410", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", ...F }}>
          {hasNote?"✎ Note":"Note"}
        </button>}
        {!publicMode && <button onClick={() => onToggleRead(node.url)} style={{ flex:1, padding:"7px 4px", background:isRead?"rgba(22,163,74,0.15)":"transparent", border:isRead?"1px solid rgba(22,163,74,0.50)":"1px solid rgba(194,65,12,0.42)", color:isRead?"#16A34A":"#1C1410", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", ...F }}>
          {isRead?"✓ Read":"To Read"}
        </button>}
        {!publicMode && onRemove && <button onClick={() => { onRemove(node); onClose(); }} style={{ flex:1, padding:"7px 4px", background:"transparent", border:"1px solid rgba(194,65,12,0.42)", color:"#C2410C", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", ...F }}>Remove</button>}
      </div>
    </div>
  );
}

// ─── Path selector (inline in sidebar) ───────────────────────────────────────

function PathSelector({ node, paths, onSavePath }) {
  const [open,     setOpen]     = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newColor, setNewColor] = useState(PATH_COLORS[0]);
  const available = paths.filter(p => !(p.item_ids || []).includes(node.id));

  function addToPath(p) {
    onSavePath({ ...p, item_ids: [...(p.item_ids || []), node.id] });
    setOpen(false);
  }

  function createAndAdd() {
    if (!newName.trim()) return;
    onSavePath({ id: crypto.randomUUID(), name: newName.trim(), description: "", color: newColor, item_ids: [node.id] });
    setNewName(""); setCreating(false);
  }

  if (creating) return (
    <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
      <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Path name…" autoFocus
        onKeyDown={e => { if(e.key==="Enter") createAndAdd(); if(e.key==="Escape") setCreating(false); }}
        style={{ ...F, background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", color:"#1C1410", fontSize:"12.5px", padding:"5px 8px", outline:"none" }} />
      <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
        {PATH_COLORS.map(c => (
          <button key={c} onClick={() => setNewColor(c)}
            style={{ width:"16px", height:"16px", borderRadius:"50%", background:c, border: newColor===c?"2px solid #1C1410":"1px solid transparent", cursor:"pointer", padding:0, flexShrink:0 }} />
        ))}
      </div>
      <div style={{ display:"flex", gap:"5px" }}>
        <button onClick={createAndAdd} style={{ ...F, flex:1, background:"transparent", border:"1px solid #C2410C", color:"#C2410C", padding:"4px", borderRadius:"3px", fontSize:"10.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Create</button>
        <button onClick={() => setCreating(false)} style={{ ...F, flex:1, background:"transparent", border:"1px solid rgba(194,65,12,0.42)", color:"#B45309", padding:"4px", borderRadius:"3px", fontSize:"10.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ ...F, width:"100%", background:"transparent", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", padding:"5px 8px", fontSize:"10.5px", letterSpacing:"0.1em", textTransform:"uppercase", color:"#B45309", cursor:"pointer", textAlign:"left" }}>
        + Add to trail {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ position:"absolute", bottom:"calc(100% + 4px)", left:0, right:0, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", boxShadow:"0 -4px 12px rgba(28,43,28,0.1)", overflow:"hidden", zIndex:50 }}>
          {paths.length > 0 && available.length === 0 && (
            <div style={{ padding:"7px 10px", fontSize:"11.5px", color:"#B45309", fontStyle:"italic" }}>Already in all paths</div>
          )}
          {available.map(p => (
            <button key={p.id} onClick={() => addToPath(p)}
              style={{ ...F, display:"flex", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.28)", padding:"6px 10px", cursor:"pointer", alignItems:"center", gap:"6px" }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(250,250,248,0.98)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:p.color, flexShrink:0 }} />
              <span style={{ fontSize:"11.5px", color:"#1C1410", flex:1 }}>{p.name}</span>
              <span style={{ fontSize:"10.5px", color:"#B45309" }}>{(p.item_ids||[]).length} items</span>
            </button>
          ))}
          <button onClick={() => { setOpen(false); setCreating(true); }}
            style={{ ...F, display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", padding:"6px 10px", cursor:"pointer", fontSize:"10.5px", color:"#C2410C", letterSpacing:"0.08em", textTransform:"uppercase" }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(250,250,248,0.98)"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
            + New trail…
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Paths management panel ───────────────────────────────────────────────────

function PathsPanel({ paths, pool, onSavePath, onDeletePath, onClose }) {
  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState("");
  const [editDesc,   setEditDesc]   = useState("");
  const [editFocus,  setEditFocus]  = useState("name");
  const [expanded,   setExpanded]   = useState(null);
  const editNameRef = useRef("");
  const editDescRef = useRef("");
  const itemMap = Object.fromEntries(pool.map(n => [n.id, n]));

  function setEditNameSynced(v) { editNameRef.current = v; setEditName(v); }
  function setEditDescSynced(v) { editDescRef.current = v; setEditDesc(v); }

  function moveItem(p, fromIdx, toIdx) {
    const ids = [...(p.item_ids || [])];
    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);
    onSavePath({ ...p, item_ids: ids });
  }

  function removeItemFromPath(p, itemId) {
    onSavePath({ ...p, item_ids: (p.item_ids || []).filter(id => id !== itemId) });
  }

  function commitEdit(p) {
    onSavePath({ ...p, name: editNameRef.current, description: editDescRef.current });
    setEditingId(null);
  }

  function flushAndClose() {
    if (editingId) {
      const p = paths.find(q => q.id === editingId);
      if (p) onSavePath({ ...p, name: editNameRef.current, description: editDescRef.current });
      setEditingId(null);
    }
    onClose();
  }

  return (
    <div style={{ ...F, position:"absolute", bottom:"44px", left:"10px", zIndex:40, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"4px", padding:"12px", width:"270px", maxHeight:"72vh", overflowY:"auto", boxShadow:"0 4px 16px rgba(43,45,66,0.1)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <span style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase" }}>Trails</span>
        <button onClick={flushAndClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#B45309", fontSize:"14.5px", padding:0, lineHeight:1 }}>×</button>
      </div>

      {paths.length === 0 && (
        <div style={{ fontSize:"12.5px", color:"#B45309", fontStyle:"italic" }}>No trails yet. Open any source in the grove and add it to a new trail.</div>
      )}

      {paths.map(p => {
        const isExpanded = expanded === p.id;
        const isEditing  = editingId === p.id;
        return (
          <div key={p.id} style={{ marginBottom:"10px", background:"rgba(250,250,248,0.97)", border:"1px solid rgba(194,65,12,0.22)", borderLeft:"3px solid "+p.color, borderRadius:"3px", padding:"8px 10px" }}>

            {/* Name row */}
            <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
              {isEditing ? (
                <input value={editName} onChange={e => setEditNameSynced(e.target.value)}
                  onKeyDown={e => { if(e.key==="Enter") commitEdit(p); if(e.key==="Escape") setEditingId(null); }}
                  onBlur={() => commitEdit(p)} autoFocus={editFocus === "name"}
                  style={{ ...F, flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.55)", outline:"none", fontSize:"12.5px", color:"#1C1410", padding:"1px 0", fontWeight:500 }} />
              ) : (
                <span onClick={() => { setEditingId(p.id); setEditNameSynced(p.name); setEditDescSynced(p.description||""); setEditFocus("name"); }}
                  style={{ flex:1, fontSize:"12.5px", color:"#1C1410", cursor:"text", fontWeight:500, lineHeight:1.3 }} title="Click to rename">{p.name}</span>
              )}
              <button onClick={() => setExpanded(v => v===p.id ? null : p.id)}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#B45309", fontSize:"11.5px", padding:"0 2px", lineHeight:1, flexShrink:0 }}>
                {(p.item_ids||[]).length} {isExpanded ? "▲" : "▼"}
              </button>
              <button onClick={() => onDeletePath(p.id)}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#C2410C", fontSize:"13.5px", padding:0, lineHeight:1, flexShrink:0, opacity:0.6 }}>×</button>
            </div>

            {/* Description */}
            {isEditing ? (
              <textarea value={editDesc} onChange={e => setEditDescSynced(e.target.value)} placeholder="Describe this trail…" rows={2}
                autoFocus={editFocus === "desc"}
                onBlur={() => commitEdit(p)}
                style={{ ...F, width:"100%", marginTop:"6px", background:"rgba(250,250,248,0.97)", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"2px", color:"#1C1410", fontSize:"11.5px", padding:"4px 6px", resize:"none", outline:"none", boxSizing:"border-box", lineHeight:1.5, fontStyle:"italic" }} />
            ) : (
              <div onClick={() => { setEditingId(p.id); setEditNameSynced(p.name); setEditDescSynced(p.description||""); setEditFocus("desc"); }}
                style={{ fontSize:"11.5px", color: p.description ? "#B45309" : "rgba(122,128,104,0.45)", fontStyle:"italic", marginTop:"4px", lineHeight:1.4, cursor:"text" }}>
                {p.description ? (p.description.length>80 ? p.description.slice(0,80)+"…" : p.description) : "Add a description…"}
              </div>
            )}

            {/* Expanded item list with reorder */}
            {isExpanded && (p.item_ids||[]).length > 0 && (
              <div style={{ marginTop:"8px", borderTop:"1px solid rgba(194,65,12,0.22)", paddingTop:"6px" }}>
                {(p.item_ids||[]).map((id, idx) => {
                  const item = itemMap[id];
                  if (!item) return null;
                  const last = idx === (p.item_ids||[]).length - 1;
                  return (
                    <div key={id} style={{ display:"flex", alignItems:"center", gap:"4px", marginBottom:"4px" }}>
                      <span style={{ fontSize:"10.5px", color:p.color, fontWeight:"bold", width:"14px", flexShrink:0, textAlign:"right" }}>{idx+1}</span>
                      <span style={{ flex:1, fontSize:"11.5px", color:"#1C1410", lineHeight:1.3 }}>
                        {item.title.length>34 ? item.title.slice(0,34)+"…" : item.title}
                      </span>
                      <button onClick={() => moveItem(p, idx, idx-1)} disabled={idx===0}
                        style={{ background:"none", border:"none", cursor:idx===0?"default":"pointer", color:idx===0?"rgba(122,128,104,0.25)":"#B45309", fontSize:"10.5px", padding:0, lineHeight:1, flexShrink:0 }}>▲</button>
                      <button onClick={() => moveItem(p, idx, idx+1)} disabled={last}
                        style={{ background:"none", border:"none", cursor:last?"default":"pointer", color:last?"rgba(122,128,104,0.25)":"#B45309", fontSize:"10.5px", padding:0, lineHeight:1, flexShrink:0 }}>▼</button>
                      <button onClick={() => removeItemFromPath(p, id)}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#C2410C", fontSize:"12.5px", padding:0, lineHeight:1, flexShrink:0, opacity:0.6 }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
            {isExpanded && (p.item_ids||[]).length === 0 && (
              <div style={{ marginTop:"6px", fontSize:"11.5px", color:"#B45309", fontStyle:"italic" }}>No items yet.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Paths view ───────────────────────────────────────────────────────────────

const TRAIL_WAVE = "M0,4 Q15,0 30,4 Q45,8 60,4 Q75,0 90,4 Q105,8 120,4 Q135,0 150,4 Q165,8 180,4 Q195,0 210,4 Q225,8 240,4 Q255,0 270,4 Q285,8 300,4 Q315,0 330,4 Q345,8 360,4 Q375,0 390,4 Q405,8 420,4 Q435,0 450,4 Q465,8 480,4 Q495,0 510,4 Q525,8 540,4 Q555,0 570,4 Q585,8 600,4 Q615,0 630,4 Q645,8 660,4 Q675,0 690,4 Q705,8 720,4 Q735,0 750,4 Q765,8 780,4 Q795,0 810,4 Q825,8 840,4 Q855,0 870,4 Q885,8 900,4";

function PathsView({ paths, pool, notes, readItems = new Set(), onToggleRead, onOpenNote, onRemove, onSavePath, orgs = [], orgLinks = [], onSaveOrgLink, onDeleteOrgLink, publicMode = false }) {
  const [selectedId,   setSelectedId]   = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const itemMap = Object.fromEntries(pool.map(n => [n.id, n]));
  const selected = paths.find(p => p.id === selectedId) || paths[0] || null;

  const connectedTitles = useMemo(() => {
    if (!selectedItem) return [];
    const kws = new Set(selectedItem.keywords || []);
    return pool
      .filter(n => n.id !== selectedItem.id && (n.keywords || []).some(k => kws.has(k)))
      .map(n => ({ ...n, keywords: (n.keywords || []).filter(k => kws.has(k)) }))
      .sort((a, b) => b.keywords.length - a.keywords.length)
      .slice(0, 12);
  }, [selectedItem, pool]);

  if (paths.length === 0) return (
    <div style={{ ...F, maxWidth:"680px", margin:"0 auto", padding:"80px 24px", textAlign:"center" }}>
      <div style={{ fontSize:"14.5px", color:"#1C1410", fontStyle:"italic" }}>No trails yet.</div>
      <div style={{ fontSize:"12.5px", color:"#B45309", marginTop:"8px" }}>Open the Grove, click any source, and add it to a new trail from the sidebar.</div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>

      {/* ── Bookmark tabs ── */}
      <div style={{ width:"38px", flexShrink:0, display:"flex", flexDirection:"column", overflowY:"auto", scrollbarWidth:"none" }}>
        {paths.map(p => (
          <button key={p.id}
            onClick={() => { setSelectedId(p.id); setSelectedItem(null); }}
            style={{ writingMode:"vertical-rl", textOrientation:"mixed", transform:"rotate(180deg)",
              fontFamily:"'Palatino Linotype',Palatino,serif", fontSize:"9.5px", letterSpacing:"0.16em",
              textTransform:"uppercase", fontWeight:600, color:"#FFFFFF", background:p.color,
              border:"none", cursor:"pointer", padding:"18px 10px", whiteSpace:"nowrap",
              flexShrink:0, textAlign:"left", transition:"opacity 0.15s, filter 0.15s",
              opacity: selected?.id === p.id ? 1 : 0.45,
              filter: selected?.id === p.id ? "none" : "saturate(0.5) brightness(0.85)" }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* ── Main pane ── */}
      <div style={{ flex:1, background:"#FFFFFF", borderLeft:"1.5px solid rgba(194,65,12,0.22)", display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
        {selected && (<>

          {/* Header */}
          <div style={{ padding:"28px 44px 22px", flexShrink:0 }}>
            <h1 style={{ ...F, fontSize:"24px", fontWeight:400, color:"#1C1410", letterSpacing:"-0.01em", margin:"0 0 7px" }}>{selected.name}</h1>
            {selected.description && (
              <p style={{ ...F, fontSize:"13px", color:"#78350F", fontStyle:"italic", lineHeight:1.6, margin:"0 0 12px" }}>{selected.description}</p>
            )}
            <div style={{ fontSize:"10px", letterSpacing:"0.12em", textTransform:"uppercase", color:"#B45309" }}>
              {(selected.item_ids||[]).length} sources
            </div>
          </div>

          {/* Reading list */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 44px 80px" }}>
            {(selected.item_ids||[]).length === 0 && (
              <div style={{ fontSize:"12.5px", color:"#B45309", fontStyle:"italic" }}>No sources in this trail yet.</div>
            )}
            {(selected.item_ids||[]).map((id, idx) => {
              const item = itemMap[id];
              if (!item) return null;
              const c = COLOR[item.theme] || "#B45309";
              const isLast = idx === (selected.item_ids||[]).length - 1;
              const isOpen = selectedItem?.id === item.id;
              return (
                <Fragment key={id}>
                  <div onClick={() => setSelectedItem(prev => prev?.id === item.id ? null : item)}
                    style={{ display:"grid", gridTemplateColumns:"36px 1fr", gap:"0 18px", padding:"20px 0 18px", cursor:"pointer" }}>
                    <div style={{ fontSize:"34px", fontWeight:400, opacity:0.09, textAlign:"right", lineHeight:1, paddingTop:"4px", color:"#1C1410" }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", alignItems:"center", fontSize:"10px", letterSpacing:"0.09em", textTransform:"uppercase", color:"#B45309", marginBottom:"6px" }}>
                        <span style={{ fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase", padding:"1px 6px", borderRadius:"2px", border:"1px solid "+c, color:c }}>{item.theme}</span>
                        <span>{item.source} · {item.published}</span>
                      </div>
                      <div style={{ ...F, fontSize:"15.5px", fontWeight:500, lineHeight:1.4, color: isOpen ? selected.color : "#1C1410", transition:"color 0.15s" }}>
                        {item.title} <span style={{ opacity:0.3, fontSize:"12px" }}>↗</span>
                      </div>
                    </div>
                  </div>
                  {!isLast && (
                    <svg width="100%" height="8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                      <path d={TRAIL_WAVE} fill="none" stroke={selected.color} strokeWidth="1" strokeOpacity="0.2"/>
                    </svg>
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* Sidebar */}
          {selectedItem && (
            <GardenSidebar
              node={selectedItem}
              onClose={() => setSelectedItem(null)}
              readItems={readItems}
              onToggleRead={onToggleRead || (() => {})}
              notes={notes}
              onOpenNote={onOpenNote || (() => {})}
              connectedTitles={connectedTitles}
              onNavigate={null}
              publicMode={publicMode}
              onRemove={onRemove}
              paths={paths}
              onSavePath={onSavePath || (() => {})}
              orgs={orgs}
              orgLinks={orgLinks}
              onSaveOrgLink={onSaveOrgLink || (() => {})}
              onDeleteOrgLink={onDeleteOrgLink || (() => {})}
            />
          )}
        </>)}
      </div>
    </div>
  );
}

// ─── Org linker (sidebar) ─────────────────────────────────────────────────────

function OrgLinker({ node, orgs, orgLinks, onSaveOrgLink, onDeleteOrgLink }) {
  const [open, setOpen]     = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const linkedOrgIds = new Set(orgLinks.filter(l => l.item_id === node.id).map(l => l.org_id));
  const available = orgs.filter(o => !linkedOrgIds.has(o.id) && (searchQ ? o.name.toLowerCase().includes(searchQ.toLowerCase()) : true));

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ ...F, width:"100%", background:"transparent", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", padding:"5px 8px", fontSize:"10.5px", letterSpacing:"0.1em", textTransform:"uppercase", color:"#B45309", cursor:"pointer", textAlign:"left" }}>
        + Link to organisation {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ position:"absolute", bottom:"calc(100% + 4px)", left:0, right:0, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", boxShadow:"0 -4px 12px rgba(28,43,28,0.1)", overflow:"hidden", zIndex:50 }}>
          <div style={{ padding:"5px 8px", borderBottom:"1px solid rgba(194,65,12,0.28)" }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search organisations…" autoFocus
              style={{ ...F, width:"100%", background:"transparent", border:"none", outline:"none", fontSize:"11.5px", color:"#1C1410", boxSizing:"border-box" }} />
          </div>
          {available.length === 0 && <div style={{ padding:"7px 10px", fontSize:"11.5px", color:"#B45309", fontStyle:"italic" }}>No organisations to link.</div>}
          {available.slice(0,6).map(org => {
            const color = STANCE_COLORS[org.stance] || "#B45309";
            return (
              <button key={org.id} onClick={() => { onSaveOrgLink(org.id, node.id); setOpen(false); setSearchQ(""); }}
                style={{ ...F, display:"flex", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.28)", padding:"6px 10px", cursor:"pointer", alignItems:"center", gap:"6px" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(250,250,248,0.98)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:color, flexShrink:0 }} />
                <span style={{ fontSize:"11.5px", color:"#1C1410", flex:1 }}>{org.name}</span>
                <span style={{ fontSize:"10.5px", color:"#B45309" }}>{org.stance.split(" / ")[0]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Add / edit org modal ─────────────────────────────────────────────────────

function AddOrgModal({ org, onSave, onClose }) {
  const iStyle = { ...F, width:"100%", background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", color:"#1C1410", fontSize:"13.5px", padding:"8px 10px", outline:"none", boxSizing:"border-box" };
  const lStyle = { fontSize:"11.5px", color:"#B45309", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:"5px" };
  const [form, setForm] = useState({
    id: org?.id || crypto.randomUUID(),
    name: org?.name || "",
    stance: org?.stance || ORG_STANCES[0],
    description: org?.description || "",
    website: org?.website || "",
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(10,30,20,0.65)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...F, background:"#FFFFFF", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"6px", width:"100%", maxWidth:"460px", overflow:"hidden" }}>
        <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid rgba(194,65,12,0.50)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"13.5px", color:"#1C1410", fontWeight:500 }}>{org ? "Edit Organisation" : "Add Organisation"}</span>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#1C1410", cursor:"pointer", fontSize:"19.5px" }}>×</button>
        </div>
        <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <label style={lStyle}>Name *</label>
            <input value={form.name} onChange={e => set("name",e.target.value)} placeholder="Organisation name" style={iStyle} autoFocus />
          </div>
          <div>
            <label style={lStyle}>Stance *</label>
            <select value={form.stance} onChange={e => set("stance",e.target.value)} style={iStyle}>
              {ORG_STANCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lStyle}>Description</label>
            <textarea value={form.description} onChange={e => set("description",e.target.value)} placeholder="What is this organisation's role or stance?" rows={3}
              style={{ ...iStyle, resize:"vertical", lineHeight:1.5 }} />
          </div>
          <div>
            <label style={lStyle}>Website</label>
            <input value={form.website} onChange={e => set("website",e.target.value)} placeholder="https://…" style={iStyle} />
          </div>
        </div>
        <div style={{ padding:"12px 18px", borderTop:"1px solid rgba(194,65,12,0.28)", display:"flex", gap:"8px", justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.50)", color:"#B45309", padding:"6px 14px", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>Cancel</button>
          <button onClick={() => { if(form.name.trim()) onSave(form); }}
            style={{ ...F, background:"transparent", border:"1px solid #C2410C", color:"#C2410C", padding:"6px 14px", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
            {org ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Org card ─────────────────────────────────────────────────────────────────

function OrgCard({ org, links, pool, isExpanded, onToggle, onEdit, onDelete, onSaveOrgLink, onDeleteOrgLink, publicMode }) {
  const [searchQ, setSearchQ]       = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const color = STANCE_COLORS[org.stance] || "#B45309";
  const itemMap = Object.fromEntries(pool.map(n => [n.id, n]));
  const linkedItems = links.map(l => itemMap[l.item_id]).filter(Boolean);

  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const linkedIds = new Set(links.map(l => l.item_id));
    return pool.filter(i => !linkedIds.has(i.id) && (i.title.toLowerCase().includes(q) || i.source.toLowerCase().includes(q))).slice(0, 6);
  }, [searchQ, pool, links]);

  return (
    <div style={{ borderBottom:"1px solid rgba(26,10,0,0.07)", padding:"14px 0" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:"16px" }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:"8px", marginBottom: org.description ? "4px" : 0 }}>
            {org.website
              ? <a href={org.website} target="_blank" rel="noopener noreferrer"
                  style={{ ...F, fontSize:"15px", fontWeight:500, color:"#1C1410", textDecoration:"none", borderBottom:"1px solid rgba(26,10,0,0.2)", transition:"border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderBottomColor = color}
                  onMouseLeave={e => e.currentTarget.style.borderBottomColor = "rgba(26,10,0,0.2)"}>
                  {org.name}
                </a>
              : <span style={{ ...F, fontSize:"15px", fontWeight:500, color:"#1C1410" }}>{org.name}</span>
            }
            {!publicMode && <>
              <button onClick={onEdit}   style={{ background:"none", border:"none", cursor:"pointer", color:"#B45309", fontSize:"12px",  padding:"0 2px", opacity:0.5 }}>✎</button>
              <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:"#C2410C", fontSize:"13px",  padding:0,       opacity:0.4 }}>×</button>
            </>}
          </div>
          {org.description && <div style={{ ...F, fontSize:"12.5px", color:"#78350F", fontStyle:"italic", lineHeight:1.5 }}>{org.description}</div>}
        </div>
        <button onClick={onToggle} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}>
          <span style={{ ...F, fontSize:"11px", color:"#B45309", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
            · {links.length} {links.length === 1 ? "piece" : "pieces"} {isExpanded ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop:"10px", paddingTop:"10px", borderTop:"1px dashed rgba(26,10,0,0.12)" }}>
          {linkedItems.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"baseline", gap:"8px", marginBottom:"6px" }}>
              <span style={{ fontSize:"9px", color:"#B45309", flexShrink:0 }}>◆</span>
              <span style={{ ...F, fontSize:"10.5px", letterSpacing:"0.07em", textTransform:"uppercase", color:COLOR[item.theme]||"#B45309", flexShrink:0 }}>{item.theme}</span>
              <span style={{ ...F, fontSize:"12.5px", color:"#1C1410", flex:1, lineHeight:1.35 }}>{item.title.length > 60 ? item.title.slice(0, 60)+"…" : item.title}</span>
              {!publicMode && <button onClick={() => onDeleteOrgLink(org.id, item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#C2410C", fontSize:"12px", padding:0, opacity:0.5, flexShrink:0 }}>×</button>}
            </div>
          ))}
          {linkedItems.length === 0 && <div style={{ fontSize:"11.5px", color:"#B45309", fontStyle:"italic", marginBottom:"8px" }}>No articles linked yet.</div>}

          {!publicMode && <div style={{ marginTop:"8px", position:"relative" }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search articles to link…"
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 150)}
              style={{ ...F, width:"100%", background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", color:"#1C1410", fontSize:"12.5px", padding:"5px 8px", outline:"none", boxSizing:"border-box" }} />
            {showSearch && searchResults.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 2px)", left:0, right:0, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", zIndex:50, overflow:"hidden", boxShadow:"0 4px 12px rgba(28,43,28,0.1)" }}>
                {searchResults.map(item => (
                  <button key={item.id} onMouseDown={() => { onSaveOrgLink(org.id, item.id); setSearchQ(""); }}
                    style={{ ...F, display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.28)", padding:"6px 10px", cursor:"pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(250,250,248,0.98)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ fontSize:"11.5px", color:"#1C1410" }}>{item.title.length > 54 ? item.title.slice(0, 54)+"…" : item.title}</div>
                    <div style={{ fontSize:"10.5px", color:"#B45309" }}>{item.source}</div>
                  </button>
                ))}
              </div>
            )}
          </div>}
        </div>
      )}
    </div>
  );
}

// ─── Field view ───────────────────────────────────────────────────────────────

function FieldView({ orgs, orgLinks, pool, onSaveOrg, onDeleteOrg, onSaveOrgLink, onDeleteOrgLink, publicMode }) {
  const [showAdd,          setShowAdd]          = useState(false);
  const [editOrg,          setEditOrg]          = useState(null);
  const [expanded,         setExpanded]         = useState(null);
  const [collapsedStances, setCollapsedStances] = useState(new Set());

  const grouped = Object.fromEntries(ORG_STANCES.map(s => [s, []]));
  orgs.forEach(org => { (grouped[org.stance] || grouped["Industry"]).push(org); });

  return (
    <div style={{ ...F, maxWidth:"800px", margin:"0 auto", padding:"28px 24px 80px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"28px", gap:"12px", flexWrap:"wrap" }}>
        <div>
        </div>
        {!publicMode && <button onClick={() => { setEditOrg(null); setShowAdd(true); }}
          style={{ ...F, background:"transparent", border:"1px solid #C2410C", color:"#C2410C", padding:"7px 16px", borderRadius:"3px", fontSize:"11.5px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", flexShrink:0 }}>
          + Add Organisation
        </button>}
      </div>

      {orgs.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#B45309", fontStyle:"italic", fontSize:"13.5px" }}>
          No organisations yet. Add the first one to start mapping the field.
        </div>
      )}

      {ORG_STANCES.map(stance => {
        const group = grouped[stance] || [];
        if (group.length === 0) return null;
        const color = STANCE_COLORS[stance];
        const isCollapsed = collapsedStances.has(stance);
        return (
          <div key={stance} style={{ marginBottom:"36px" }}>
            <button
              onClick={() => setCollapsedStances(prev => { const s = new Set(prev); s.has(stance) ? s.delete(stance) : s.add(stance); return s; })}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:"14px", marginBottom: isCollapsed ? 0 : "4px", padding:"8px 0", background:"none", border:"none", cursor:"pointer" }}>
              <svg style={{ flex:1 }} height="8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,4 Q15,0 30,4 Q45,8 60,4 Q75,0 90,4 Q105,8 120,4 Q135,0 150,4 Q165,8 180,4 Q195,0 210,4 Q225,8 240,4 Q255,0 270,4 Q285,8 300,4 Q315,0 330,4 Q345,8 360,4 Q375,0 390,4 Q405,8 420,4 Q435,0 450,4 Q465,8 480,4 Q495,0 510,4 Q525,8 540,4 Q555,0 570,4 Q585,8 600,4" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
              </svg>
              <span style={{ ...F, fontSize:"10px", letterSpacing:"0.22em", textTransform:"uppercase", fontWeight:600, color, whiteSpace:"nowrap" }}>
                {stance} {isCollapsed ? "▸" : "▾"}
              </span>
              <svg style={{ flex:1 }} height="8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,4 Q15,0 30,4 Q45,8 60,4 Q75,0 90,4 Q105,8 120,4 Q135,0 150,4 Q165,8 180,4 Q195,0 210,4 Q225,8 240,4 Q255,0 270,4 Q285,8 300,4 Q315,0 330,4 Q345,8 360,4 Q375,0 390,4 Q405,8 420,4 Q435,0 450,4 Q465,8 480,4 Q495,0 510,4 Q525,8 540,4 Q555,0 570,4 Q585,8 600,4" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
              </svg>
            </button>
            {!isCollapsed && (
              <div style={{ display:"flex", flexDirection:"column" }}>
                {group.map(org => (
                  <OrgCard key={org.id} org={org}
                    links={orgLinks.filter(l => l.org_id === org.id)}
                    pool={pool}
                    isExpanded={expanded === org.id}
                    onToggle={() => setExpanded(v => v===org.id ? null : org.id)}
                    onEdit={() => { setEditOrg(org); setShowAdd(true); }}
                    onDelete={() => onDeleteOrg(org.id)}
                    onSaveOrgLink={onSaveOrgLink}
                    onDeleteOrgLink={onDeleteOrgLink}
                    publicMode={publicMode} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showAdd && (
        <AddOrgModal org={editOrg}
          onSave={org => { onSaveOrg(org); setShowAdd(false); setEditOrg(null); }}
          onClose={() => { setShowAdd(false); setEditOrg(null); }} />
      )}
    </div>
  );
}

// Compute inter-theme connection counts — used to position bubbles smartly
function interThemeWeights(items, links) {
  const itemTheme = Object.fromEntries(items.map(n => [n.id, n.theme]));
  const w = {};
  THEMES.forEach(a => THEMES.forEach(b => { w[a.name+"||"+b.name] = 0; }));
  links.forEach(l => {
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    const st = itemTheme[sid], tt = itemTheme[tid];
    if(st && tt && st !== tt) {
      const key = [st,tt].sort().join("||");
      w[key] = (w[key]||0) + 1;
    }
  });
  return w;
}

// Deterministic LCG random for consistent wobbly blob shapes
function seededRand(seed) {
  let s = Math.abs(seed * 1664525 + 1013904223) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function blobPath(cx, cy, r, seed, nPts = 14) {
  const rng = seededRand(seed);
  const pts = Array.from({ length: nPts }, (_, i) => {
    const a = (i / nPts) * Math.PI * 2;
    const w = 1 + (rng() - 0.5) * 0.24;
    return [cx + r * w * Math.cos(a), cy + r * w * Math.sin(a)];
  });
  return d3.line().curve(d3.curveBasisClosed)(pts);
}

// Run a tiny synchronous force layout to place bubbles by connection density
function computeBubblePositions(items, links, W, H, bubbleR, themes = THEMES) {
  const weights = interThemeWeights(items, links);
  const N = themes.length;
  const maxBubR = bubbleR ? Math.max(...Object.values(bubbleR)) : 120;
  // Elliptical ring: use available width and height independently so
  // landscape canvases spread bubbles horizontally instead of cramming
  // everything into a circle constrained by the shorter dimension.
  const outerRx = Math.max(120, W/2 - maxBubR - 40);
  const outerRy = Math.max(80,  H/2 - maxBubR - 40);
  const pos = {};
  themes.forEach((t, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    pos[t.name] = { x: W/2 + outerRx * Math.cos(a), y: H/2 + outerRy * Math.sin(a) };
  });

  // 120 iterations of force-directed bubble placement
  for(let iter = 0; iter < 120; iter++) {
    const alpha = 1 - iter / 120;
    const forces = {};
    themes.forEach(t => { forces[t.name] = {x:0, y:0}; });

    // Attraction between theme pairs proportional to shared keyword connections
    themes.forEach((a, i) => {
      themes.forEach((b, j) => {
        if(i >= j) return;
        const key = [a.name,b.name].sort().join("||");
        const wt = weights[key] || 0;
        if(wt === 0) return;
        const dx = pos[b.name].x - pos[a.name].x;
        const dy = pos[b.name].y - pos[a.name].y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        const str = wt * 0.001 * alpha;
        forces[a.name].x += dx/dist * str;
        forces[a.name].y += dy/dist * str;
        forces[b.name].x -= dx/dist * str;
        forces[b.name].y -= dy/dist * str;
      });
    });

    // Repulsion: per-pair min distance based on actual bubble radii + gap
    themes.forEach((a, i) => {
      themes.forEach((b, j) => {
        if(i >= j) return;
        const dx = pos[b.name].x - pos[a.name].x;
        const dy = pos[b.name].y - pos[a.name].y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        const ra = (bubbleR && bubbleR[a.name]) || maxBubR;
        const rb = (bubbleR && bubbleR[b.name]) || maxBubR;
        const minDist = ra + rb + 90;
        if(dist < minDist) {
          const push = (minDist - dist) / minDist * 0.7 * alpha;
          forces[a.name].x -= dx/dist * push;
          forces[a.name].y -= dy/dist * push;
          forces[b.name].x += dx/dist * push;
          forces[b.name].y += dy/dist * push;
        }
      });
    });

    // Pull all back toward canvas center
    themes.forEach(t => {
      forces[t.name].x += (W/2 - pos[t.name].x) * 0.01 * alpha;
      forces[t.name].y += (H/2 - pos[t.name].y) * 0.01 * alpha;
    });

    themes.forEach(t => {
      pos[t.name].x += forces[t.name].x;
      pos[t.name].y += forces[t.name].y;
      // clamp bubble centres so the bubble circle stays on-canvas
      const margin = (bubbleR && bubbleR[t.name]) ? bubbleR[t.name] + 20 : maxBubR + 20;
      pos[t.name].x = Math.max(margin, Math.min(W - margin, pos[t.name].x));
      pos[t.name].y = Math.max(margin, Math.min(H - margin, pos[t.name].y));
    });
  }
  return pos;
}

// ─── Org sidebar ──────────────────────────────────────────────────────────────

function OrgSidebar({ org, orgLinks, pool, onClose, onNavigate }) {
  const color = STANCE_COLORS[org.stance] || "#B45309";
  const linkedItems = orgLinks
    .filter(l => l.org_id === org.id)
    .map(l => pool.find(p => p.id === l.item_id))
    .filter(Boolean);

  let websiteDisplay = "";
  if (org.website) {
    try { websiteDisplay = new URL(org.website).hostname.replace(/^www\./, ""); } catch { websiteDisplay = org.website; }
  }

  return (
    <div style={{ position:"absolute", top:0, right:0, width:"280px", height:"100%", background:"#FAFAF8", borderLeft:"1px solid rgba(194,65,12,0.35)", display:"flex", flexDirection:"column", zIndex:30, overflow:"hidden" }}>
      <div style={{ padding:"14px 14px 10px", borderBottom:"1px solid rgba(194,65,12,0.22)", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:color, flexShrink:0 }} />
            <span style={{ fontSize:"14.5px", fontWeight:500, color:"#1C1410", lineHeight:1.2 }}>{org.name}</span>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#1C1410", cursor:"pointer", fontSize:"19.5px", lineHeight:1, flexShrink:0, paddingLeft:"8px" }}>×</button>
        </div>
        <div style={{ fontSize:"10.5px", color, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom: org.description || org.website ? "8px" : 0 }}>{org.stance}</div>
        {org.website && (
          <a href={org.website} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:"12.5px", color:"#C2410C", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:"3px", marginBottom:"6px" }}>
            ↗ {websiteDisplay}
          </a>
        )}
        {org.description && <p style={{ fontSize:"12.5px", color:"#B45309", fontStyle:"italic", lineHeight:1.5, margin:0 }}>{org.description}</p>}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
        <div style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"10px" }}>
          Linked Articles ({linkedItems.length})
        </div>
        {linkedItems.length === 0 && (
          <div style={{ fontSize:"12.5px", color:"rgba(122,128,104,0.5)", fontStyle:"italic" }}>No articles linked yet.</div>
        )}
        {linkedItems.map(item => (
          <button key={item.id} onClick={() => { onNavigate(item.id); onClose(); }}
            style={{ display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.28)", padding:"7px 0", cursor:"pointer" }}>
            <div style={{ display:"flex", gap:"5px", alignItems:"center", marginBottom:"2px" }}>
              <span style={{ fontSize:"10.5px", color: COLOR[item.theme]||"#B45309", letterSpacing:"0.07em", textTransform:"uppercase", flexShrink:0 }}>{item.theme}</span>
              <span style={{ fontSize:"10.5px", color:"#B45309" }}>· {item.source}</span>
            </div>
            <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.4, fontFamily:"'Palatino Linotype',Palatino,serif" }}>
              {item.title.length > 70 ? item.title.slice(0,70)+"…" : item.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GardenView({ pool, readItems, onToggleRead, notes, onSaveNote, publicMode, onRemove, paths = [], onSavePath, onDeletePath, orgs = [], orgLinks = [], onSaveOrgLink, onDeleteOrgLink, customThemeColors = {} }) {
  const svgRef        = useRef(null);
  const simRef        = useRef(null);
  const linksRef      = useRef([]);
  const nodeSelRef    = useRef(null);
  const linkSelRef    = useRef(null);
  const readRef       = useRef(readItems);
  const zoomRef       = useRef(null);
  const nodesRef      = useRef([]);
  const pathGroupRef  = useRef(null);
  const orgGroupRef   = useRef(null);
  const pathsRef      = useRef(paths);
  const orgsRef       = useRef(orgs);
  const orgLinksRef   = useRef(orgLinks);
  const showOrgsRef   = useRef(false);

  const [selected,       setSelected]       = useState(null);
  const [selectedOrg,    setSelectedOrg]    = useState(null);
  const [dimTheme,       setDimTheme]       = useState(null);
  const [ready,          setReady]          = useState(false);
  const [tooltip,        setTooltip]        = useState(null);
  const [noteItem,       setNoteItem]       = useState(null);
  const [pathsPanelOpen,     setPathsPanelOpen]     = useState(false);
  const [showOrgs,           setShowOrgs]           = useState(false);
  const [trailsOpen,         setTrailsOpen]         = useState(false);
  const [highlightedTrailId, setHighlightedTrailId] = useState(null);
  const pathsVisibleRef      = useRef(false);
  const highlightedTrailRef  = useRef(null);

  // Pan + zoom to a node by id, then open its sidebar
  const navigateToNode = useCallback((nodeId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if(!node || !svgRef.current || !zoomRef.current) return;
    const W = svgRef.current.clientWidth  || window.innerWidth;
    const H = svgRef.current.clientHeight || window.innerHeight - 88;
    const scale = 2.0;
    const tx = W/2 - scale * node.x;
    const ty = H/2 - scale * node.y;
    d3.select(svgRef.current)
      .transition().duration(550).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    setSelected({...node});
  }, []);

  // Keep readRef and pathsRef in sync without triggering sim rebuild
  useEffect(() => { readRef.current = readItems; }, [readItems]);
  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { orgsRef.current = orgs; orgLinksRef.current = orgLinks; }, [orgs, orgLinks]);
  useEffect(() => { showOrgsRef.current = showOrgs; }, [showOrgs]);

  // Draw path overlay lines + step badges from settled node positions
  const drawPathOverlay = useCallback(() => {
    if (!pathGroupRef.current || !nodesRef.current.length) return;
    const pg = pathGroupRef.current;
    pg.selectAll("*").remove();
    if (!pathsVisibleRef.current) return;
    const nodePos = Object.fromEntries(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]));
    const hlId = highlightedTrailRef.current;
    const activePaths = hlId ? (pathsRef.current || []).filter(p => p.id === hlId) : (pathsRef.current || []);

    activePaths.forEach(p => {
      const ids = p.item_ids || [];
      if (ids.length < 1) return;
      for (let i = 0; i < ids.length - 1; i++) {
        const a = nodePos[ids[i]], b = nodePos[ids[i+1]];
        if (!a || !b) continue;
        pg.append("line")
          .attr("x1", a.x).attr("y1", a.y).attr("x2", b.x).attr("y2", b.y)
          .attr("stroke", p.color || "#C2410C").attr("stroke-width", 2.5)
          .attr("stroke-opacity", 0.55).attr("stroke-dasharray", "8 4")
          .attr("pointer-events", "none");
      }
      ids.forEach((id, idx) => {
        const pos = nodePos[id];
        if (!pos) return;
        pg.append("circle").attr("cx", pos.x).attr("cy", pos.y).attr("r", 9)
          .attr("fill", p.color || "#C2410C").attr("fill-opacity", 0.88)
          .attr("pointer-events", "none");
        pg.append("text").attr("x", pos.x).attr("y", pos.y)
          .attr("text-anchor", "middle").attr("dominant-baseline", "central")
          .attr("font-size", "7px").attr("fill", "white")
          .attr("font-family", "'Palatino Linotype',Palatino,serif")
          .attr("font-weight", "bold").attr("pointer-events", "none")
          .text(idx + 1);
      });
    });
  }, []);

  const connectedTitles = useMemo(() => {
    if(!selected) return [];
    const nodeMap = Object.fromEntries(pool.map(n => [n.id, n]));
    return linksRef.current
      .filter(l => l.source?.id === selected.id || l.target?.id === selected.id)
      .map(l => {
        const oid = l.source?.id === selected.id ? l.target?.id : l.source?.id;
        const o = nodeMap[oid];
        return o ? {...o, keywords: l.keywords} : null;
      })
      .filter(Boolean)
      .sort((a,b) => b.keywords.length - a.keywords.length);
  }, [selected, pool]);

  // All themes: built-in + any custom themes found in pool
  const allThemes = useMemo(() => {
    const customNames = [...new Set(pool.map(i => i.theme))].filter(n => !THEMES.find(t => t.name === n));
    return [...THEMES, ...customNames.map(n => ({ name: n, color: customThemeColor(n, customThemeColors) }))];
  }, [pool, customThemeColors]);

  useEffect(() => { setTimeout(() => setReady(true), 120); }, []);

  // ── Main D3 effect — only reruns when pool changes, NOT on readItems ──
  useEffect(() => {
    if(!svgRef.current || !ready) return;

    const W = svgRef.current.clientWidth  || window.innerWidth;
    const H = svgRef.current.clientHeight || (window.innerHeight - 88);
    const items = pool;
    const links = buildLinks(items);
    linksRef.current = links;

    // Bubble radii scale with both node count and canvas size.
    // Multiplier 40 ensures nodes have room at ~60% packing even on the
    // smaller public-garden canvas (canvasScale ≈ 0.93).
    const themeCount = {};
    allThemes.forEach(t => { themeCount[t.name] = 0; });
    items.forEach(n => { themeCount[n.theme] = (themeCount[n.theme] || 0) + 1; });
    const canvasScale = Math.min(W, H) / 700;
    const bubbleR = {};
    allThemes.forEach(t => { bubbleR[t.name] = Math.max(85 * canvasScale, Math.sqrt(themeCount[t.name] || 0) * 40 * canvasScale); });

    // Smart bubble positions from inter-theme connection density
    const rawPos = computeBubblePositions(items, links, W, H, bubbleR, allThemes);
    // Shift bubble center slightly inward so label above fits
    const bubblePos = {};
    allThemes.forEach(t => {
      bubblePos[t.name] = { cx: rawPos[t.name].x, cy: rawPos[t.name].y };
    });

    // Node initial positions scattered inside their bubble
    const nodes = items.map(item => {
      const bp = bubblePos[item.theme];
      const a  = Math.random() * 2 * Math.PI;
      const r  = Math.random() * 18;
      return { ...item, x: bp.cx + r * Math.cos(a), y: bp.cy + r * Math.sin(a) };
    });

    // ── Build SVG ──
    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);

    // Defs
    const defs = svg.append("defs");
    allThemes.forEach(t => {
      const grad = defs.append("radialGradient")
        .attr("id", "rbg_" + t.name.replace(/\s/g,"_"))
        .attr("cx","50%").attr("cy","50%").attr("r","50%");
      grad.append("stop").attr("offset","0%").attr("stop-color", t.color).attr("stop-opacity", 0.16);
      grad.append("stop").attr("offset","100%").attr("stop-color", t.color).attr("stop-opacity", 0.03);
    });
    const sf = defs.append("filter").attr("id","sticker-shadow").attr("x","-30%").attr("y","-30%").attr("width","160%").attr("height","160%");
    sf.append("feDropShadow").attr("dx",1).attr("dy",2).attr("stdDeviation",2.5).attr("flood-color","rgba(26,10,0,0.12)");
    const gf = defs.append("filter").attr("id","glow3").attr("x","-50%").attr("y","-50%").attr("width","200%").attr("height","200%");
    gf.append("feGaussianBlur").attr("stdDeviation","3").attr("result","blur");
    const fm = gf.append("feMerge");
    fm.append("feMergeNode").attr("in","blur");
    fm.append("feMergeNode").attr("in","SourceGraphic");

    const zoom = d3.zoom().scaleExtent([0.15, 4]).on("zoom", e => {
      g.attr("transform", e.transform);
      const k = e.transform.k;
      labelSel.attr("opacity", k < 0.4 ? 0 : k < 0.8 ? (k-0.4)*1.5 : Math.min(1, 0.6 + (k-0.8)*0.8));
    });
    zoomRef.current = zoom;
    svg.call(zoom);
    const g = svg.append("g");

    // Bubble backgrounds
    const bg = g.append("g");
    allThemes.forEach((t, ti) => {
      const bp = bubblePos[t.name], r = bubbleR[t.name];
      const blob = blobPath(bp.cx, bp.cy, r, ti * 31 + 7);
      bg.append("path").attr("d", blob)
        .attr("fill", "url(#rbg_" + t.name.replace(/\s/g,"_") + ")");
      bg.append("path").attr("d", blob)
        .attr("fill","none").attr("stroke", t.color)
        .attr("stroke-opacity", 0.42).attr("stroke-width", 1.8);

      // Sticker label — direction away from all other bubble centres
      let fx = 0, fy = 0;
      allThemes.forEach(other => {
        if (other.name === t.name) return;
        const op = bubblePos[other.name];
        const odx = bp.cx - op.cx, ody = bp.cy - op.cy;
        const od2 = odx*odx + ody*ody || 1;
        fx += odx / od2; fy += ody / od2;
      });
      const flen = Math.sqrt(fx*fx + fy*fy) || 1;
      const lcos = fx / flen, lsin = fy / flen;
      const ax = bp.cx + (r + 16) * lcos;
      const ay = bp.cy + (r + 16) * lsin;
      const label = t.name.toUpperCase();
      const FSIZ = 10.5, PX = 9, PY = 5;
      const sg = bg.append("g").attr("filter","url(#sticker-shadow)");
      const sRect = sg.append("rect").attr("rx",3).attr("fill","#FFFFFF")
        .attr("stroke",t.color).attr("stroke-width",1.5).attr("stroke-opacity",0.85);
      // Render text first so getBBox() measures actual rendered width
      const sTxt = sg.append("text")
        .attr("x",0).attr("y",0)
        .attr("text-anchor","middle").attr("font-size", FSIZ+"px")
        .attr("font-family","'Palatino Linotype',Palatino,serif")
        .attr("letter-spacing","0.07em").attr("fill",t.color).attr("font-weight",600)
        .text(label);
      const bb  = sTxt.node().getBBox();
      const bw  = bb.width + PX * 2, bh = bb.height + PY * 2;
      const bx  = ax + lcos * (bw / 2 + 2) - bw / 2;
      const by  = ay + lsin * (bh / 2 + 2) - bh / 2;
      sRect.attr("x",bx).attr("y",by).attr("width",bw).attr("height",bh);
      sTxt.attr("x", bx + bw/2).attr("y", by + bh/2 + bb.height * 0.36);
    });

    // Draw ALL cross-bubble links (intra-bubble are too dense visually but all
    // connections show on hover via the full links array)
    const crossLinks = links.filter(l => {
      const s = items.find(n => n.id === (typeof l.source==="object"?l.source.id:l.source));
      const t = items.find(n => n.id === (typeof l.target==="object"?l.target.id:l.target));
      return s && t && s.theme !== t.theme;
    });

    const linkSel = g.append("g")
      .selectAll("path").data(crossLinks).enter().append("path")
      .attr("fill","none").attr("stroke","rgba(194,65,12,0.28)").attr("stroke-width",0.8)
      .style("pointer-events","none");
    linkSelRef.current = linkSel;

    // Path overlay — sits between links and nodes
    const pathGroup = g.append("g");
    pathGroupRef.current = pathGroup;

    // Org overlay — sits above path overlay, below nodes
    const orgGroup = g.append("g");
    orgGroupRef.current = orgGroup;

    const NR = 5;

    // Compute degree for node sizing
    const degree = {};
    items.forEach(n => { degree[n.id] = 0; });
    links.forEach(l => {
      const sid = typeof l.source==="object" ? l.source.id : l.source;
      const tid = typeof l.target==="object" ? l.target.id : l.target;
      degree[sid] = (degree[sid]||0) + 1;
      degree[tid] = (degree[tid]||0) + 1;
    });
    nodes.forEach(n => { n.degree = degree[n.id] || 0; });
    const maxDeg = d3.max(nodes, d => d.degree) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxDeg]).range([NR, NR+5]);

    const nodeSel = g.append("g")
      .selectAll("circle").data(nodes).enter().append("circle")
      .attr("r", d => rScale(d.degree))
      .attr("fill", d => COLOR[d.theme])
      .attr("fill-opacity", d => readRef.current.has(d.url) ? 0.2 : 0.82)
      .attr("stroke", d => COLOR[d.theme]).attr("stroke-opacity", 0.5).attr("stroke-width", 1)
      .style("cursor","pointer")
      .call(d3.drag()
        .on("start", (e,d) => { if(!e.active && simRef.current) simRef.current.alphaTarget(0.2).restart(); d.fx=d.x; d.fy=d.y; })
        .on("drag",  (e,d) => { d.fx=e.x; d.fy=e.y; })
        .on("end",   (e,d) => { if(!e.active && simRef.current) simRef.current.alphaTarget(0); d.fx=null; d.fy=null; drawPathOverlay(); drawOrgOverlay(); })
      )
      .on("mouseenter", function(e, d) {
        const rect = svgRef.current.getBoundingClientRect();
        setTooltip({ x: e.clientX-rect.left, y: e.clientY-rect.top-14, text: d.title.length>60 ? d.title.slice(0,60)+"…" : d.title });
        d3.select(this).attr("r", rScale(d.degree)+3).attr("filter","url(#glow3)").attr("fill-opacity",1);
        // Highlight ALL connections (intra + inter bubble)
        const connIds = new Set(
          links
            .filter(l => l.source?.id===d.id || l.target?.id===d.id)
            .flatMap(l => [l.source?.id, l.target?.id])
        );
        nodeSel.attr("fill-opacity", n => n.id===d.id ? 1 : connIds.has(n.id) ? 0.9 : 0.08);
        linkSel
          .attr("stroke", l => (l.source?.id===d.id||l.target?.id===d.id) ? COLOR[d.theme]+"dd" : "rgba(194,65,12,0.08)")
          .attr("stroke-width", l => (l.source?.id===d.id||l.target?.id===d.id) ? 2 : 0.3);
      })
      .on("mousemove", function(e) {
        const rect = svgRef.current.getBoundingClientRect();
        setTooltip(t => t ? {...t, x:e.clientX-rect.left, y:e.clientY-rect.top-14} : t);
      })
      .on("mouseleave", function(e, d) {
        setTooltip(null);
        d3.select(this).attr("r", rScale(d.degree)).attr("filter",null);
        resetOp();
      })
      .on("click", (e,d) => { e.stopPropagation(); setSelected(d); setSelectedOrg(null); });

    nodeSelRef.current = nodeSel;

    // Labels — visible at default zoom, fade in/out with zoom level
    const labelSel = g.append("g")
      .selectAll("text").data(nodes).enter().append("text")
      .text(d => d.title.split(":")[0].split("—")[0].trim().slice(0, 22))
      .attr("font-size","10px")
      .attr("font-family","'Palatino Linotype',Palatino,serif")
      .attr("fill","#1C1410")
      .attr("text-anchor","middle")
      .attr("dy", d => rScale(d.degree) + 10)
      .attr("opacity", 0.6)
      .style("pointer-events","none")
      .style("user-select","none");

    svg.on("click", () => { setSelected(null); setSelectedOrg(null); setHighlightedTrailId(null); });

    function resetOp() {
      nodeSel.attr("fill-opacity", d => readRef.current.has(d.url) ? 0.2 : 0.82);
      linkSel.attr("stroke","rgba(194,65,12,0.28)").attr("stroke-width",0.8);
    }

    // Simulation
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(280).strength(0.02))
      .force("charge", d3.forceManyBody().strength(-700))
      .force("collision", d3.forceCollide(d => rScale(d.degree) + 20))
      .force("bubble", () => {
        nodes.forEach(d => {
          const bp = bubblePos[d.theme], r = bubbleR[d.theme];
          const dx = d.x - bp.cx, dy = d.y - bp.cy;
          const dist = Math.sqrt(dx*dx+dy*dy) || 0.01;
          // Gentle pull toward bubble center
          d.vx -= dx * 0.05;
          d.vy -= dy * 0.05;
          // Hard wall at bubble edge
          const maxR = r - rScale(d.degree) - 3;
          if(dist > maxR) {
            const over = dist - maxR;
            d.vx -= (dx/dist) * over * 0.5;
            d.vy -= (dy/dist) * over * 0.5;
          }
        });
      })
      .alphaDecay(0.013)
      .on("tick", () => {
        linkSel.attr("d", d => {
          const mx=(d.source.x+d.target.x)/2, my=(d.source.y+d.target.y)/2;
          const dx=d.target.x-d.source.x, dy=d.target.y-d.source.y;
          const len=Math.sqrt(dx*dx+dy*dy)||1;
          const cv=Math.min(len*0.18,55);
          return `M${d.source.x} ${d.source.y} Q${mx-dy/len*cv} ${my+dx/len*cv} ${d.target.x} ${d.target.y}`;
        });
        nodeSel.attr("cx",d=>d.x).attr("cy",d=>d.y);
        labelSel.attr("x",d=>d.x).attr("y",d=>d.y);
        drawPathOverlay();
        drawOrgOverlay();
      });

    simRef.current = sim;
    linksRef.current = links;
    nodesRef.current = nodes;

    sim.on("end", () => { drawPathOverlay(); drawOrgOverlay(); });
    const pathTimer = setTimeout(() => { drawPathOverlay(); drawOrgOverlay(); }, 2500);

    return () => { sim.stop(); clearTimeout(pathTimer); };
  }, [ready, pool]); // ← readItems, paths, drawPathOverlay intentionally NOT here

  // ── Opacity-only update when readItems changes — no sim restart ──
  useEffect(() => {
    if(!nodeSelRef.current) return;
    nodeSelRef.current.attr("fill-opacity", d => readItems.has(d.url) ? 0.2 : 0.82);
  }, [readItems]);

  // ── Redraw path overlay whenever paths change ──
  useEffect(() => {
    drawPathOverlay();
  }, [paths, drawPathOverlay]);

  // ── Sync trail overlay visibility with panel/toggle state ──
  useEffect(() => {
    pathsVisibleRef.current = publicMode ? trailsOpen : pathsPanelOpen;
    drawPathOverlay();
  }, [trailsOpen, pathsPanelOpen, publicMode, drawPathOverlay]);

  // ── Redraw when highlighted trail changes ──
  useEffect(() => {
    highlightedTrailRef.current = highlightedTrailId;
    drawPathOverlay();
  }, [highlightedTrailId, drawPathOverlay]);

  // ── Draw/clear org overlay when showOrgs, orgs, or orgLinks change ──
  const drawOrgOverlay = useCallback(() => {
    if (!orgGroupRef.current) return;
    const og = orgGroupRef.current;
    og.selectAll("*").remove();
    // Clean up old favicon clip paths
    const svgEl = d3.select(svgRef.current);
    let defs = svgEl.select("defs");
    if (defs.empty()) defs = svgEl.append("defs");
    defs.selectAll("[id^='org-clip-']").remove();

    if (!showOrgsRef.current) return;
    const currentOrgs = orgsRef.current || [];
    const currentLinks = orgLinksRef.current || [];
    if (currentOrgs.length === 0 || !nodesRef.current.length) return;
    const W = svgRef.current?.clientWidth || window.innerWidth;
    const H = svgRef.current?.clientHeight || (window.innerHeight - 88);
    const nodePos = Object.fromEntries(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]));

    // Compute outerR from actual settled node positions so the ring always clears
    // the theme sticker labels regardless of canvas aspect ratio.
    const bandHalf = 22;
    const maxNodeDist = nodesRef.current.length
      ? Math.max(...nodesRef.current.map(n => Math.hypot(n.x - W / 2, n.y - H / 2)))
      : Math.min(W, H) * 0.35;
    const outerR = maxNodeDist + 80; // 80px clears bubble border + sticker label box

    const activeStances = ORG_STANCES.filter(s => currentOrgs.some(o => o.stance === s));
    const numSections = activeStances.length || 1;
    const arcSize = (2 * Math.PI) / numSections;
    const gap = arcSize * 0.06;
    const orgPos = {};

    // helper: SVG arc path between two angles at a given radius
    function arcPath(cx, cy, r, a1, a2) {
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = (a2 - a1) > Math.PI ? 1 : 0;
      return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    }

    activeStances.forEach((stance, si) => {
      const color = STANCE_COLORS[stance];
      const stanceOrgs = currentOrgs.filter(o => o.stance === stance);
      const arcStart = si * arcSize - Math.PI / 2 + gap / 2;
      const arcEnd   = (si + 1) * arcSize - Math.PI / 2 - gap / 2;
      const midAngle = (arcStart + arcEnd) / 2;

      // ── Arc band background (pie-slice donut segment) ──
      const r1 = outerR - bandHalf, r2 = outerR + bandHalf;
      const x1s = W/2 + r1*Math.cos(arcStart), y1s = H/2 + r1*Math.sin(arcStart);
      const x1e = W/2 + r1*Math.cos(arcEnd),   y1e = H/2 + r1*Math.sin(arcEnd);
      const x2s = W/2 + r2*Math.cos(arcStart), y2s = H/2 + r2*Math.sin(arcStart);
      const x2e = W/2 + r2*Math.cos(arcEnd),   y2e = H/2 + r2*Math.sin(arcEnd);
      const large = (arcEnd - arcStart) > Math.PI ? 1 : 0;
      const bandD = [
        `M ${x1s} ${y1s}`,
        `A ${r1} ${r1} 0 ${large} 1 ${x1e} ${y1e}`,
        `L ${x2e} ${y2e}`,
        `A ${r2} ${r2} 0 ${large} 0 ${x2s} ${y2s}`,
        "Z"
      ].join(" ");
      og.append("path")
        .attr("d", bandD)
        .attr("fill", color).attr("fill-opacity", 0.07)
        .attr("stroke", color).attr("stroke-opacity", 0.28).attr("stroke-width", 1)
        .attr("pointer-events", "none");

      // ── Stance label inside the band at arc midpoint ──
      const shortName = stance === "Policy / Think Tank" ? "POLICY" :
                        stance === "Civil Society / Advocacy" ? "CIVIL SOCIETY" :
                        stance.toUpperCase();
      og.append("text")
        .attr("x", W/2 + outerR * Math.cos(midAngle))
        .attr("y", H/2 + outerR * Math.sin(midAngle))
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .attr("font-size", "10px").attr("font-family", "'Palatino Linotype',Palatino,serif")
        .attr("fill", color).attr("fill-opacity", 0.8)
        .attr("letter-spacing", "0.1em").attr("pointer-events", "none")
        .text(shortName);

      // ── Scatter orgs randomly within the donut band (stable via hash) ──
      stanceOrgs.forEach((org) => {
        const h = orgHash(org.id);
        const angle = arcStart + ((h % 10000) / 10000) * (arcEnd - arcStart);
        const r     = (outerR - bandHalf + 4) + (((h >> 13) % 10000) / 10000) * (bandHalf * 2 - 8);
        orgPos[org.id] = { x: W/2 + r * Math.cos(angle), y: H/2 + r * Math.sin(angle) };
      });
    });

    // Lines first (below circles)
    currentLinks.forEach(link => {
      const op = orgPos[link.org_id], ap = nodePos[link.item_id];
      if (!op || !ap) return;
      const color = STANCE_COLORS[currentOrgs.find(o => o.id === link.org_id)?.stance] || "#B45309";
      og.append("line")
        .attr("x1", op.x).attr("y1", op.y).attr("x2", ap.x).attr("y2", ap.y)
        .attr("stroke", color).attr("stroke-width", 1)
        .attr("stroke-opacity", 0.22).attr("stroke-dasharray", "4 4")
        .attr("pointer-events", "none");
    });

    // Org circles + favicons + labels
    currentOrgs.forEach(org => {
      const pos = orgPos[org.id];
      if (!pos) return;
      const color = STANCE_COLORS[org.stance] || "#B45309";
      const r = Math.max(14, Math.min(22, 10 + currentLinks.filter(l => l.org_id === org.id).length * 2));

      og.append("circle")
        .attr("cx", pos.x).attr("cy", pos.y).attr("r", r)
        .attr("fill", color).attr("fill-opacity", 0.13)
        .attr("stroke", color).attr("stroke-opacity", 0.65).attr("stroke-width", 1.5)
        .style("cursor", "pointer")
        .on("mouseenter", e => {
          const rect = svgRef.current.getBoundingClientRect();
          setTooltip({ x: e.clientX-rect.left, y: e.clientY-rect.top-14, text: org.name + (org.stance ? ` · ${org.stance}` : "") });
        })
        .on("mouseleave", () => setTooltip(null))
        .on("click", (e) => { e.stopPropagation(); setSelectedOrg(org); setSelected(null); });

      // Favicon from Google's service if org has a website
      if (org.website) {
        try {
          const domain = new URL(org.website).hostname;
          const clipId = `org-clip-${org.id}`;
          defs.append("clipPath").attr("id", clipId)
            .append("circle").attr("cx", pos.x).attr("cy", pos.y).attr("r", r - 2);
          og.append("image")
            .attr("href", `https://www.google.com/s2/favicons?domain=${domain}&sz=64`)
            .attr("x", pos.x - r + 2).attr("y", pos.y - r + 2)
            .attr("width", (r - 2) * 2).attr("height", (r - 2) * 2)
            .attr("clip-path", `url(#${clipId})`)
            .attr("pointer-events", "none");
        } catch {}
      }

      og.append("text")
        .attr("x", pos.x).attr("y", pos.y + r + 13)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("font-family", "'Palatino Linotype',Palatino,serif")
        .attr("fill", color).attr("fill-opacity", 0.85)
        .attr("letter-spacing", "0.04em").attr("pointer-events", "none")
        .text(org.name.length > 20 ? org.name.slice(0,20)+"…" : org.name);
    });
  }, []);

  useEffect(() => {
    drawOrgOverlay();
  }, [showOrgs, orgs, orgLinks, drawOrgOverlay]);

  // ── Theme filter ──
  useEffect(() => {
    if(!nodeSelRef.current || !linkSelRef.current) return;
    if(dimTheme) {
      nodeSelRef.current.attr("fill-opacity", d => d.theme===dimTheme ? (readItems.has(d.url)?0.28:0.92) : 0.05);
      linkSelRef.current
        .attr("stroke", l => {
          const st = l.source?.theme, tt = l.target?.theme;
          return (st===dimTheme || tt===dimTheme) ? COLOR[dimTheme]+"99" : "rgba(255,255,255,0.01)";
        })
        .attr("stroke-width", l => {
          const st = l.source?.theme, tt = l.target?.theme;
          return (st===dimTheme || tt===dimTheme) ? 1.5 : 0.3;
        });
    } else {
      nodeSelRef.current.attr("fill-opacity", d => readItems.has(d.url) ? 0.2 : 0.82);
      linkSelRef.current.attr("stroke","rgba(194,65,12,0.28)").attr("stroke-width",0.8);
    }
  }, [dimTheme, readItems]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen,  setSearchOpen]  = useState(false);
  const searchRef = useRef(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const articles = pool.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.theme.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.keywords.some(k => k.toLowerCase().includes(q))
    ).slice(0, 6).map(item => ({ _type: "article", ...item }));
    const orgResults = orgs.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.stance || "").toLowerCase().includes(q) ||
      (o.description || "").toLowerCase().includes(q)
    ).slice(0, 3).map(o => ({ _type: "org", ...o }));
    const trailResults = paths.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    ).slice(0, 2).map(p => ({ _type: "trail", ...p }));
    return [...articles, ...orgResults, ...trailResults];
  }, [searchQuery, pool, orgs, paths]);

  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const sideOpen = !!selected;
  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      {/* Theme filter pills */}
      <div style={{ position:"absolute", top:"10px", left:"10px", zIndex:10, display:"flex", flexDirection:"column", gap:"3px" }}>
        {allThemes.map(t => (
          <button key={t.name} onClick={() => setDimTheme(d => d===t.name ? null : t.name)}
            style={{ ...F, display:"flex", alignItems:"center", gap:"6px", background:dimTheme===t.name?t.color+"22":"#FAFAF8", border:"1px solid "+(dimTheme===t.name?t.color:"rgba(194,65,12,0.42)"), borderRadius:"3px", padding:"3px 8px", cursor:"pointer", transition:"all 0.15s" }}>
            <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:t.color, flexShrink:0 }} />
            <span style={{ fontSize:"11.5px", letterSpacing:"0.07em", textTransform:"uppercase", color:dimTheme===t.name?t.color:"#1C1410", whiteSpace:"nowrap" }}>{t.name}</span>
          </button>
        ))}
        {dimTheme && (
          <button onClick={() => setDimTheme(null)} style={{ ...F, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", padding:"3px 8px", cursor:"pointer", color:"#B45309", fontSize:"11.5px", letterSpacing:"0.07em", textTransform:"uppercase" }}>Clear</button>
        )}
        {publicMode ? (
          paths.length > 0 && (
            <button onClick={() => setTrailsOpen(v => !v)}
              style={{ ...F, marginTop:"6px", background: trailsOpen?"rgba(194,65,12,0.32)":"#FAFAF8", border:"1px solid "+(trailsOpen?"rgba(194,65,12,0.50)":"rgba(194,65,12,0.42)"), borderRadius:"3px", padding:"3px 8px", cursor:"pointer", transition:"all 0.15s" }}>
              <span style={{ fontSize:"11.5px", letterSpacing:"0.07em", textTransform:"uppercase", color: trailsOpen?"#C2410C":"#1C1410", whiteSpace:"nowrap" }}>
                Trails ({paths.length})
              </span>
            </button>
          )
        ) : (
          <button onClick={() => setPathsPanelOpen(v => !v)}
            style={{ ...F, marginTop:"6px", background: pathsPanelOpen?"rgba(194,65,12,0.32)":"#FAFAF8", border:"1px solid "+(pathsPanelOpen?"rgba(194,65,12,0.50)":"rgba(194,65,12,0.42)"), borderRadius:"3px", padding:"3px 8px", cursor:"pointer", transition:"all 0.15s" }}>
            <span style={{ fontSize:"11.5px", letterSpacing:"0.07em", textTransform:"uppercase", color: pathsPanelOpen?"#C2410C":"#1C1410", whiteSpace:"nowrap" }}>
              Trails{paths.length > 0 ? ` (${paths.length})` : ""}
            </span>
          </button>
        )}
        <button onClick={() => setShowOrgs(v => !v)}
          style={{ ...F, marginTop:"3px", background: showOrgs?"rgba(16,104,212,0.13)":"#FAFAF8", border:"1px solid "+(showOrgs?"rgba(16,104,212,0.5)":"rgba(194,65,12,0.42)"), borderRadius:"3px", padding:"3px 8px", cursor:"pointer", transition:"all 0.15s" }}>
          <span style={{ fontSize:"11.5px", letterSpacing:"0.07em", textTransform:"uppercase", color: showOrgs?"#C2410C":"#1C1410", whiteSpace:"nowrap" }}>
            Orgs{orgs.length > 0 ? ` (${orgs.length})` : ""}
          </span>
        </button>
      </div>

      {pathsPanelOpen && !publicMode && (
        <PathsPanel paths={paths} pool={pool} onSavePath={onSavePath} onDeletePath={onDeletePath} onClose={() => setPathsPanelOpen(false)} />
      )}

      {publicMode && trailsOpen && paths.length > 0 && (
        <div style={{ ...F, position:"absolute", bottom:"12px", left:"10px", zIndex:10, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"4px", padding:"10px 12px" }}>
          <div style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"7px" }}>Trails</div>
          {paths.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"4px" }}>
              <svg width="18" height="5" style={{ flexShrink:0 }}>
                <line x1="0" y1="2.5" x2="18" y2="2.5" stroke={p.color} strokeWidth="2.5" strokeDasharray="5 2" />
              </svg>
              <span style={{ fontSize:"11.5px", color:"#1C1410" }}>{p.name}</span>
              {p.description && <span style={{ fontSize:"10.5px", color:"#B45309", fontStyle:"italic" }}>— {p.description.length>36 ? p.description.slice(0,36)+"…" : p.description}</span>}
            </div>
          ))}
        </div>
      )}

      <svg ref={svgRef} style={{ position:"absolute", inset:0, width:(sideOpen||!!selectedOrg)?"calc(100% - 290px)":"100%", height:"100%", background:"transparent" }} />

      {tooltip && (
        <div style={{ position:"absolute", left:tooltip.x, top:tooltip.y, transform:"translate(-50%,-100%)", background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", padding:"5px 10px", fontSize:"12.5px", color:"#1C1410", pointerEvents:"none", zIndex:50, maxWidth:"260px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", ...F }}>
          {tooltip.text}
        </div>
      )}

      {/* Search box */}
      <div ref={searchRef} style={{ position:"absolute", top:"10px", right: (sideOpen||!!selectedOrg) ? "300px" : "10px", zIndex:20, transition:"right 0.2s" }}>
        <div style={{ display:"flex", alignItems:"center", background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.42)", borderRadius:"3px", padding:"4px 8px", gap:"6px" }}>
          <span style={{ fontSize:"12.5px", color:"#B45309", opacity:0.6 }}>⌕</span>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={e => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } }}
            placeholder="Search sources, orgs, trails…"
            style={{ ...F, background:"transparent", border:"none", outline:"none", fontSize:"12.5px", color:"#1C1410", width:"180px", "::placeholder":{ color:"#B45309" } }}
          />
          {searchQuery && <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#B45309", fontSize:"13.5px", padding:0, lineHeight:1 }}>×</button>}
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div style={{ position:"absolute", top:"calc(100% + 4px)", right:0, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", minWidth:"280px", maxWidth:"360px", boxShadow:"0 4px 16px rgba(43,45,66,0.1)", overflow:"hidden" }}>
            {searchResults.map(r => {
              if (r._type === "org") {
                const color = STANCE_COLORS[r.stance] || "#B45309";
                return (
                  <button key={"org-"+r.id} onClick={() => { setSelectedOrg(r); setSearchOpen(false); setSearchQuery(""); }}
                    style={{ ...F, display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.28)", padding:"8px 12px", cursor:"pointer", transition:"background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(250,250,248,0.98)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.3, marginBottom:"3px" }}>{r.name}</div>
                    <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                      <span style={{ fontSize:"10.5px", color, letterSpacing:"0.07em", textTransform:"uppercase" }}>Org</span>
                      <span style={{ fontSize:"10.5px", color:"#B45309" }}>· {r.stance}</span>
                    </div>
                  </button>
                );
              }
              if (r._type === "trail") {
                return (
                  <button key={"trail-"+r.id} onClick={() => { setHighlightedTrailId(r.id); if (publicMode) { setTrailsOpen(true); pathsVisibleRef.current = true; } else setPathsPanelOpen(true); setSearchOpen(false); setSearchQuery(""); }}
                    style={{ ...F, display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.28)", padding:"8px 12px", cursor:"pointer", transition:"background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(250,250,248,0.98)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"2px" }}>
                      <svg width="16" height="4" style={{ flexShrink:0 }}><line x1="0" y1="2" x2="16" y2="2" stroke={r.color||"#C2410C"} strokeWidth="2" strokeDasharray="4 2" /></svg>
                      <span style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.3 }}>{r.name}</span>
                    </div>
                    <span style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.07em", textTransform:"uppercase" }}>Trail · {(r.item_ids||[]).length} stops</span>
                  </button>
                );
              }
              return (
                <button key={r.id} onClick={() => { navigateToNode(r.id); setSearchOpen(false); setSearchQuery(""); }}
                  style={{ ...F, display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", borderBottom:"1px solid rgba(194,65,12,0.28)", padding:"8px 12px", cursor:"pointer", transition:"background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background="rgba(250,250,248,0.98)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.3, marginBottom:"3px" }}>{r.title}</div>
                  <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                    <span style={{ fontSize:"10.5px", color: COLOR[r.theme] || "#B45309", letterSpacing:"0.08em", textTransform:"uppercase" }}>{r.theme}</span>
                    <span style={{ fontSize:"10.5px", color:"#B45309" }}>· {r.source}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
          <div style={{ position:"absolute", top:"calc(100% + 4px)", right:0, background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"3px", padding:"10px 12px", fontSize:"12.5px", color:"#B45309", fontStyle:"italic" }}>No results</div>
        )}
      </div>

      {sideOpen && <GardenSidebar node={selected} onClose={() => setSelected(null)} readItems={readItems} onToggleRead={onToggleRead} notes={notes} onOpenNote={setNoteItem} connectedTitles={connectedTitles} onNavigate={navigateToNode} publicMode={publicMode} onRemove={onRemove} paths={paths} onSavePath={onSavePath} orgs={orgs} orgLinks={orgLinks} onSaveOrgLink={onSaveOrgLink} onDeleteOrgLink={onDeleteOrgLink} />}
      {selectedOrg && <OrgSidebar org={selectedOrg} orgLinks={orgLinks} pool={pool} onClose={() => setSelectedOrg(null)} onNavigate={nodeId => { navigateToNode(nodeId); setSelectedOrg(null); }} />}
      {noteItem  && <NotesModal item={noteItem} notes={notes} onSave={onSaveNote} onClose={() => setNoteItem(null)} />}
      {!ready    && <div style={{ position:"absolute",inset:0,background:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99 }}><span style={{ ...F, fontSize:"12.5px",color:"#B45309",letterSpacing:"0.15em",textTransform:"uppercase" }}>Growing the garden…</span></div>}
    </div>
  );
}


// ─── Stats view ───────────────────────────────────────────────────────────────

function StatBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
      <div style={{ flex:1, height:"4px", background:"rgba(194,65,12,0.50)", borderRadius:"2px", overflow:"hidden" }}>
        <div style={{ height:"100%", width: pct+"%", background: color, borderRadius:"2px", transition:"width 0.6s ease" }} />
      </div>
      <span style={{ fontSize:"11.5px", color:"#1C1410", width:"36px", textAlign:"right" }}>{value}/{max}</span>
    </div>
  );
}

function StatsView({ pool, readItems, notes }) {
  const essays      = pool.filter(x => x.type === "essay");
  const papers      = pool.filter(x => x.type !== "essay");
  const foundational= pool.filter(x => x.type === "foundational");
  const recent      = pool.filter(x => x.type === "recent");

  const readEssays  = essays.filter(x => readItems.has(x.url));
  const readPapers  = papers.filter(x => readItems.has(x.url));
  const readFound   = foundational.filter(x => readItems.has(x.url));
  const readRecent  = recent.filter(x => readItems.has(x.url));

  const totalRead   = readItems.size;
  const totalMins   = pool.filter(x => readItems.has(x.url)).reduce((s,x) => s + x.readingMinutes, 0);
  const totalNotes  = Object.keys(notes).length;

  // Per-theme breakdown
  const themeStats  = THEMES.map(t => {
    const all  = pool.filter(x => x.theme === t.name);
    const done = all.filter(x => readItems.has(x.url));
    const noted= all.filter(x => notes[x.url]);
    return { ...t, total: all.length, read: done.length, noted: noted.length };
  }).sort((a, b) => b.read - a.read);

  const maxThemeTotal = Math.max(...themeStats.map(t => t.total));

  // Notes list — most recent shown by order of pool
  const notedItems = pool.filter(x => notes[x.url]).slice().reverse().slice(0, 12);

  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return (
    <div style={{ ...F, maxWidth:"680px", margin:"0 auto", padding:"32px 24px 80px" }}>

      {/* Hero numbers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:"10px", marginBottom:"36px" }}>
        {[
          { label:"Total read",    value: totalRead,  sub: `of ${pool.length}`,   color:"#16A34A" },
          { label:"Essays read",   value: readEssays.length, sub:`of ${essays.length}`, color:"#C2410C" },
          { label:"Papers read",   value: readPapers.length, sub:`of ${papers.length}`, color:"#7A9B6A" },
          { label:"Notes written", value: totalNotes, sub:`across ${pool.length} items`, color:"#C2410C" },
        ].map(s => (
          <div key={s.label} style={{ background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.50)", borderTop:"2px solid "+s.color, borderRadius:"3px", padding:"14px 14px 12px" }}>
            <div style={{ fontSize:"21.5px", color: s.color, fontWeight:400, lineHeight:1, marginBottom:"5px" }}>{s.value}</div>
            <div style={{ fontSize:"11.5px", color:"#1C1410", letterSpacing:"0.05em" }}>{s.label}</div>
            <div style={{ fontSize:"11.5px", color:"#1C1410", marginTop:"2px" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Academic breakdown */}
      <div style={{ marginBottom:"36px" }}>
        <div style={{ fontSize:"11.5px", color:"#B45309", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"14px" }}>Academic breakdown</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {[
            { label:"Foundational papers", read: readFound.length, total: foundational.length, color:"#C2410C" },
            { label:"Recent papers",       read: readRecent.length, total: recent.length,       color:"#7A9B6A" },
          ].map(row => (
            <div key={row.label}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                <span style={{ fontSize:"12.5px", color:"#1C1410" }}>{row.label}</span>
                <span style={{ fontSize:"12.5px", color: row.read===row.total && row.total>0 ? "#16A34A":"#1C1410" }}>
                  {row.read===row.total && row.total>0 ? "✓ Complete" : `${Math.round(row.read/row.total*100)||0}%`}
                </span>
              </div>
              <StatBar value={row.read} max={row.total} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Per-theme breakdown */}
      <div style={{ marginBottom:"36px" }}>
        <div style={{ fontSize:"11.5px", color:"#1C1410", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"14px" }}>Progress by theme</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {themeStats.map(t => (
            <div key={t.name}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"5px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:t.color }} />
                  <span style={{ fontSize:"12.5px", color:"#1C1410" }}>{t.name}</span>
                  {t.noted > 0 && <span style={{ fontSize:"10.5px", color:"#C2410C", background:"rgba(194,65,12,0.28)", border:"1px solid rgba(194,65,12,0.35)", borderRadius:"2px", padding:"1px 5px" }}>✎ {t.noted} note{t.noted>1?"s":""}</span>}
                </div>
                <span style={{ fontSize:"11.5px", color: t.read===t.total ? "#16A34A":"#B45309" }}>
                  {t.read}/{t.total}
                </span>
              </div>
              <StatBar value={t.read} max={t.total} color={t.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Notes list */}
      {notedItems.length > 0 && (
        <div>
          <div style={{ fontSize:"11.5px", color:"#1C1410", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"14px" }}>
            Your notes ({totalNotes})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
            {notedItems.map(item => {
              const n = notes[item.url];
              const c = COLOR[item.theme] || "#B45309";
              return (
                <div key={item.url} style={{ background:"rgba(250,250,248,0.98)", border:"1px solid rgba(194,65,12,0.42)", borderLeft:"3px solid "+c, borderRadius:"3px", padding:"12px 14px" }}>
                  <div style={{ display:"flex", gap:"6px", alignItems:"center", marginBottom:"6px", flexWrap:"wrap" }}>
                    <span style={{ fontSize:"10.5px", letterSpacing:"0.1em", textTransform:"uppercase", padding:"1px 6px", borderRadius:"2px", background:c+"22", color:c, fontWeight:600 }}>{item.theme}</span>
                    <span style={{ fontSize:"11.5px", color:"#1C1410", fontStyle:"italic" }}>{item.source} · {item.published}</span>
                  </div>
                  <div style={{ fontSize:"13.5px", color:"#1C1410", marginBottom:"10px", lineHeight:1.4, fontWeight:500 }}>{item.title}</div>
                  {n.quote && (
                    <div style={{ marginBottom:"8px", borderLeft:"2px solid rgba(194,65,12,0.55)", paddingLeft:"8px" }}>
                      <div style={{ fontSize:"10.5px", color:"#C2410C", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"3px" }}>Quote</div>
                      <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.6, fontStyle:"italic" }}>{n.quote}</div>
                    </div>
                  )}
                  {n.argument && (
                    <div style={{ marginBottom: n.thoughts ? "8px" : 0 }}>
                      <div style={{ fontSize:"10.5px", color:"#C2410C", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"3px" }}>Argument</div>
                      <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.6 }}>{n.argument}</div>
                    </div>
                  )}
                  {n.thoughts && (
                    <div>
                      <div style={{ fontSize:"10.5px", color:"#7A9B6A", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"3px" }}>My thoughts</div>
                      <div style={{ fontSize:"12.5px", color:"#B45309", lineHeight:1.6 }}>{n.thoughts}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalRead === 0 && (
        <div style={{ marginTop:"60px", textAlign:"center" }}>
          <div style={{ fontSize:"13.5px", color:"#1C1410", fontStyle:"italic" }}>No items marked as read yet.</div>
          <div style={{ fontSize:"12.5px", color:"#B45309", marginTop:"6px" }}>Head to The Plot tab and start reading.</div>
        </div>
      )}
    </div>
  );
}

// ─── Root app ─────────────────────────────────────────────────────────────────

const NAV = { ...F, background:"transparent", border:"1px solid rgba(194,65,12,0.50)", color:"#B45309", width:"28px", height:"28px", borderRadius:"3px", cursor:"pointer", fontSize:"14.5px", display:"inline-flex", alignItems:"center", justifyContent:"center" };

export function PublicGardenPage() {
  const [pool,        setPool]        = useState(BUILTIN);
  const [notes,       setNotes]       = useState({});
  const [paths,       setPaths]       = useState([]);
  const [orgs,        setOrgs]        = useState([]);
  const [orgLinks,    setOrgLinks]    = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loaded,      setLoaded]      = useState(false);
  const [tab,         setTab]         = useState("garden");

  useEffect(() => {
    Promise.all([
      supabase.from("custom_items").select("*"),
      supabase.from("notes").select("url, argument, thoughts, quote"),
      supabase.from("hidden_items").select("item_id"),
      supabase.from("garden_meta").select("last_updated").limit(1).single(),
      supabase.from("paths").select("*"),
      supabase.from("organisations").select("*"),
      supabase.from("org_article_links").select("*"),
    ]).then(([{ data: cd }, { data: nd }, { data: hd }, { data: gm }, { data: pd }, { data: od }, { data: ld }]) => {
      const hiddenSet = new Set((hd || []).map(h => h.item_id));
      const customMapped = (cd || []).map(c => ({ id: c.item_id, title: c.title, url: c.url, source: c.source, published: c.published, keywords: c.keywords || [], readingMinutes: c.reading_minutes, theme: c.theme, type: c.type }));
      setPool([...BUILTIN.filter(i => !hiddenSet.has(i.id)), ...customMapped.filter(i => !hiddenSet.has(i.id))]);
      if (nd?.length) setNotes(Object.fromEntries(nd.map(n => [n.url, { argument: n.argument, thoughts: n.thoughts, quote: n.quote || "" }])));
      if (gm?.last_updated) setLastUpdated(new Date(gm.last_updated).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }));
      if (pd?.length) setPaths(pd.map(p => ({ id: p.id, name: p.name, description: p.description || "", color: p.color, item_ids: p.item_ids || [] })));
      if (od?.length) setOrgs(od.map(o => ({ id: o.id, name: o.name, stance: o.stance, description: o.description || "", website: o.website || "" })));
      if (ld?.length) setOrgLinks(ld.map(l => ({ id: l.id, org_id: l.org_id, item_id: l.item_id })));
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <div style={{ ...F, height:"100vh", background:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:"12.5px", color:"#B45309", letterSpacing:"0.15em", textTransform:"uppercase" }}>Growing the garden…</span></div>;

  const PUBLIC_TABS = [
    { id:"garden", label:"The Grove", icon:"🌿", desc:"Network of knowledge, actors, and ideas." },
    { id:"paths",  label:"Trails",    icon:"🗺️", desc:"Theme specific curriculum for the intellectually curious." },
    { id:"field",  label:"The Field", icon:"🏛️", desc:"List of orgs and communities." },
  ];

  return (
    <div style={{ height:"100vh", background:"#FFFFFF", color:"#1C1410", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ background:"#FAFAF8", borderBottom:"1px solid rgba(194,65,12,0.35)", paddingLeft:"18px", paddingRight:"18px", paddingTop:"10px", paddingBottom:"10px", flexShrink:0, backdropFilter:"blur(4px)", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
          <span style={{ fontSize:"15.5px", lineHeight:1 }}>🪸</span>
          <span style={{ ...F, fontSize:"12.5px", color:"#1C1410", letterSpacing:"0.12em", textTransform:"uppercase" }}>Plot Twists</span>
          {lastUpdated && <span style={{ ...F, fontSize:"11.5px", color:"#B45309", fontStyle:"italic", marginLeft:"auto" }}>Updated {lastUpdated}</span>}
        </div>
        <p style={{ ...F, fontSize:"12.5px", color:"#1C1410", lineHeight:1.5, margin:"0 0 8px" }}>
          Hi, I'm Prabhnoor, a researcher in critical AI studies. This is my digital garden exploring AI safety, policy, bias, decolonisation, and more.{" "}
          <a href="https://prabhnoorkohli.fyi" target="_blank" rel="noopener noreferrer" style={{ color:"#C2410C", textDecoration:"underline" }}>More about me & my work ↗</a>
        </p>
        {/* Tab bar */}
        <div style={{ display:"flex", gap:"4px", marginBottom:"6px" }}>
          {PUBLIC_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...F, background: tab===t.id ? "rgba(194,65,12,0.22)" : "transparent", border: tab===t.id ? "1px solid rgba(194,65,12,0.42)" : "1px solid transparent", borderRadius:"3px", padding:"4px 12px", fontSize:"11.5px", letterSpacing:"0.09em", textTransform:"uppercase", color: tab===t.id ? "#C2410C" : "#B45309", cursor:"pointer", gap:"5px" }}>
              <span style={{ marginRight:"4px" }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subtitle strip */}
      <div style={{ height:"26px", background:"#FAFAF8", borderBottom:"1px solid rgba(194,65,12,0.15)", display:"flex", alignItems:"center", paddingLeft:"18px", flexShrink:0 }}>
        {TAB_SUBTITLES[tab] && <span style={{ ...F, fontSize:"10px", letterSpacing:"0.18em", textTransform:"uppercase", color:"#B45309", fontStyle:"italic" }}>{TAB_SUBTITLES[tab]}</span>}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow: tab==="garden" ? "hidden" : "auto", position:"relative" }}>
        {tab === "garden" && <GardenView pool={pool} readItems={new Set()} onToggleRead={() => {}} notes={notes} onSaveNote={() => {}} publicMode={true} paths={paths} orgs={orgs} orgLinks={orgLinks} />}
        {tab === "paths"  && <PathsView paths={paths} pool={pool} notes={notes} publicMode={true} orgs={orgs} orgLinks={orgLinks} />}
        {tab === "field"  && <FieldView orgs={orgs} orgLinks={orgLinks} pool={pool} onSaveOrg={() => {}} onDeleteOrg={() => {}} onSaveOrgLink={() => {}} onDeleteOrgLink={() => {}} publicMode={true} />}
      </div>
    </div>
  );
}

function SetPasswordScreen({ onDone }) {
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) setError(err.message);
    else { setDone(true); setTimeout(onDone, 1500); }
  }

  return (
    <div style={{ ...F, height:"100vh", background:"#FFFFFF", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"32px" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"13.5px", letterSpacing:"0.18em", textTransform:"uppercase", color:"#1C1410" }}>Plot Twists</div>
        <div style={{ fontSize:"12.5px", color:"#B45309", fontStyle:"italic", marginTop:"6px" }}>Set your password</div>
      </div>
      {done ? (
        <div style={{ fontSize:"12.5px", color:"#1C1410" }}>Password set. Entering…</div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"12px", width:"260px" }}>
          <input type="password" required placeholder="New password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ ...F, background:"rgba(250,250,248,1.0)", border:"1px solid rgba(194,65,12,0.42)", color:"#1C1410", fontSize:"12.5px", padding:"9px 12px", borderRadius:"3px", outline:"none" }} />
          <input type="password" required placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)}
            style={{ ...F, background:"rgba(250,250,248,1.0)", border:"1px solid rgba(194,65,12,0.42)", color:"#1C1410", fontSize:"12.5px", padding:"9px 12px", borderRadius:"3px", outline:"none" }} />
          {error && <div style={{ fontSize:"12.5px", color:"#C2410C" }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ ...F, background:"#C2410C", color:"#FFFFFF", border:"none", padding:"10px", fontSize:"12.5px", letterSpacing:"0.12em", textTransform:"uppercase", cursor: loading ? "default" : "pointer", borderRadius:"3px", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Saving…" : "Set password"}
          </button>
        </form>
      )}
    </div>
  );
}

function LoginScreen() {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: "prabhnoorkohliwork@gmail.com",
      password,
    });
    setLoading(false);
    if (err) setError("Incorrect password.");
  }

  return (
    <div style={{ ...F, height:"100vh", background:"#FFFFFF", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"32px" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"13.5px", letterSpacing:"0.18em", textTransform:"uppercase", color:"#1C1410" }}>Plot Twists</div>
        <div style={{ fontSize:"12.5px", color:"#B45309", fontStyle:"italic", marginTop:"6px" }}>Prabhnoor's Digital Garden</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"12px", width:"260px" }}>
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ ...F, background:"rgba(250,250,248,1.0)", border:"1px solid rgba(194,65,12,0.42)", color:"#1C1410", fontSize:"12.5px", padding:"9px 12px", borderRadius:"3px", outline:"none" }}
        />
        {error && <div style={{ fontSize:"12.5px", color:"#C2410C" }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{ ...F, background:"#C2410C", color:"#FFFFFF", border:"none", padding:"10px", fontSize:"12.5px", letterSpacing:"0.12em", textTransform:"uppercase", cursor: loading ? "default" : "pointer", borderRadius:"3px", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Entering…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [tab, setTab]             = useState("dispatch");
  const [customItems, setCustomItems] = useState([]);
  const [customThemeColors, setCustomThemeColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem("plottwists_theme_colors") || "{}"); } catch { return {}; }
  });
  const [readItems, setReadItems] = useState(new Set());
  const [notes, setNotes]         = useState({});
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [paths, setPaths]         = useState([]);
  const [orgs, setOrgs]           = useState([]);
  const [orgLinks, setOrgLinks]   = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [user,        setUser]        = useState(null);
  const [authReady,   setAuthReady]   = useState(false);
  const [recovering,  setRecovering]  = useState(() => window.location.hash.includes("type=recovery"));

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setRecovering(true); return; }
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setLoaded(false); return; }
    Promise.all([
      supabase.from("read_items").select("url").eq("user_id", user.id),
      supabase.from("notes").select("url, argument, thoughts, quote").eq("user_id", user.id),
      supabase.from("custom_items").select("*").eq("user_id", user.id),
      supabase.from("hidden_items").select("item_id").eq("user_id", user.id),
      supabase.from("paths").select("*").eq("user_id", user.id),
      supabase.from("organisations").select("*").eq("user_id", user.id),
      supabase.from("org_article_links").select("*").eq("user_id", user.id),
    ]).then(([{ data: rd }, { data: nd }, { data: cd }, { data: hd }, { data: pd }, { data: od }, { data: ld }]) => {
      setReadItems(new Set((rd || []).map(r => r.url)));
      setNotes(Object.fromEntries((nd || []).map(n => [n.url, { argument: n.argument, thoughts: n.thoughts, quote: n.quote || "" }])));
      setCustomItems((cd || []).map(c => ({ id: c.item_id, title: c.title, url: c.url, source: c.source, published: c.published, keywords: c.keywords || [], readingMinutes: c.reading_minutes, theme: c.theme, type: c.type })));
      setHiddenIds(new Set((hd || []).map(h => h.item_id)));
      setPaths((pd || []).map(p => ({ id: p.id, name: p.name, description: p.description || "", color: p.color, item_ids: p.item_ids || [] })));
      setOrgs((od || []).map(o => ({ id: o.id, name: o.name, stance: o.stance, description: o.description || "", website: o.website || "" })));
      setOrgLinks((ld || []).map(l => ({ id: l.id, org_id: l.org_id, item_id: l.item_id })));
      setLoaded(true);
    });
  }, [user]);

  const pool = useMemo(() => [...BUILTIN.filter(i => !hiddenIds.has(i.id)), ...customItems.filter(i => !hiddenIds.has(i.id))], [customItems, hiddenIds]);

  const bumpLastUpdated = useCallback(() => {
    supabase.from("garden_meta").upsert({ user_id: user.id, last_updated: new Date().toISOString() }, { onConflict: "user_id" })
      .then(({ error }) => { if (error) console.error("garden_meta upsert:", error); });
  }, [user]);

  const toggleRead = useCallback(key => {
    const removing = readItems.has(key);
    setReadItems(prev => {
      const next = new Set(prev);
      if (removing) next.delete(key); else next.add(key);
      return next;
    });
    const op = removing
      ? supabase.from("read_items").delete().eq("user_id", user.id).eq("url", key)
      : supabase.from("read_items").insert({ user_id: user.id, url: key });
    op.then(({ error }) => { if (error) console.error("read_items error:", error); else bumpLastUpdated(); });
  }, [user, readItems, bumpLastUpdated]);

  const saveNote = useCallback((url, data) => {
    setNotes(prev => {
      const next = { ...prev };
      if (data === null) delete next[url]; else next[url] = data;
      return next;
    });
    const op = data === null
      ? supabase.from("notes").delete().eq("user_id", user.id).eq("url", url)
      : supabase.from("notes").upsert({ user_id: user.id, url, argument: data.argument || "", thoughts: data.thoughts || "", quote: data.quote || "", updated_at: new Date().toISOString() }, { onConflict: "user_id,url" });
    op.then(({ error }) => { if (error) console.error("notes error:", error); else bumpLastUpdated(); });
  }, [user, bumpLastUpdated]);

  const saveThemeColor = useCallback((name, color) => {
    setCustomThemeColors(prev => {
      const next = { ...prev, [name]: color };
      localStorage.setItem("plottwists_theme_colors", JSON.stringify(next));
      return next;
    });
  }, []);

  const addItem = useCallback(item => {
    setCustomItems(prev => [...prev, item]);
    supabase.from("custom_items").insert({ user_id: user.id, item_id: item.id, title: item.title, url: item.url, source: item.source, published: item.published, keywords: item.keywords, reading_minutes: item.readingMinutes, theme: item.theme, type: item.type })
      .then(({ error }) => { if (error) console.error("custom_items insert:", error); else bumpLastUpdated(); });
  }, [user, bumpLastUpdated]);

  const deleteItem = useCallback(id => {
    setCustomItems(prev => prev.filter(x => x.id !== id));
    supabase.from("custom_items").delete().eq("user_id", user.id).eq("item_id", id)
      .then(({ error }) => { if (error) console.error("custom_items delete:", error); else bumpLastUpdated(); });
  }, [user, bumpLastUpdated]);

  const hideItem = useCallback(id => {
    setHiddenIds(prev => new Set([...prev, id]));
    supabase.from("hidden_items").insert({ user_id: user.id, item_id: id })
      .then(({ error }) => { if (error) console.error("hidden_items insert:", error); else bumpLastUpdated(); });
  }, [user, bumpLastUpdated]);

  const restoreItem = useCallback(id => {
    setHiddenIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    supabase.from("hidden_items").delete().eq("user_id", user.id).eq("item_id", id)
      .then(({ error }) => { if (error) console.error("hidden_items delete:", error); else bumpLastUpdated(); });
  }, [user, bumpLastUpdated]);

  const savePath = useCallback((path) => {
    setPaths(prev => {
      const isNew = !prev.some(p => p.id === path.id);
      if (isNew) {
        supabase.from("paths").insert({ id: path.id, user_id: user.id, name: path.name, description: path.description || "", color: path.color, item_ids: path.item_ids, updated_at: new Date().toISOString() })
          .then(({ error }) => { if (error) console.error("paths insert:", error); });
        return [...prev, path];
      }
      supabase.from("paths").update({ name: path.name, description: path.description || "", color: path.color, item_ids: path.item_ids, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("id", path.id)
        .then(({ error }) => { if (error) console.error("paths update:", error); });
      return prev.map(p => p.id === path.id ? path : p);
    });
  }, [user]);

  const deletePath = useCallback((id) => {
    setPaths(prev => prev.filter(p => p.id !== id));
    supabase.from("paths").delete().eq("user_id", user.id).eq("id", id)
      .then(({ error }) => { if (error) console.error("paths delete:", error); });
  }, [user]);

  const saveOrg = useCallback((org) => {
    setOrgs(prev => {
      const isNew = !prev.some(o => o.id === org.id);
      if (isNew) {
        supabase.from("organisations").insert({ id: org.id, user_id: user.id, name: org.name, stance: org.stance, description: org.description || "", website: org.website || "" })
          .then(({ error }) => { if (error) console.error("orgs insert:", error); });
        return [...prev, org];
      }
      supabase.from("organisations").update({ name: org.name, stance: org.stance, description: org.description || "", website: org.website || "", updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("id", org.id)
        .then(({ error }) => { if (error) console.error("orgs update:", error); });
      return prev.map(o => o.id === org.id ? org : o);
    });
  }, [user]);

  const deleteOrg = useCallback((id) => {
    setOrgs(prev => prev.filter(o => o.id !== id));
    setOrgLinks(prev => prev.filter(l => l.org_id !== id));
    supabase.from("organisations").delete().eq("user_id", user.id).eq("id", id)
      .then(({ error }) => { if (error) console.error("orgs delete:", error); });
  }, [user]);

  const saveOrgLink = useCallback((orgId, itemId) => {
    const id = crypto.randomUUID();
    setOrgLinks(prev => [...prev, { id, org_id: orgId, item_id: itemId }]);
    supabase.from("org_article_links").insert({ id, user_id: user.id, org_id: orgId, item_id: itemId })
      .then(({ error }) => { if (error) console.error("org_link insert:", error); });
  }, [user]);

  const deleteOrgLink = useCallback((orgId, itemId) => {
    setOrgLinks(prev => prev.filter(l => !(l.org_id === orgId && l.item_id === itemId)));
    supabase.from("org_article_links").delete().eq("user_id", user.id).eq("org_id", orgId).eq("item_id", itemId)
      .then(({ error }) => { if (error) console.error("org_link delete:", error); });
  }, [user]);

  const removeFromPool = useCallback(item => {
    const isCustom = customItems.some(c => c.id === item.id);
    if (isCustom) deleteItem(item.id);
    else hideItem(item.id);
  }, [customItems, deleteItem, hideItem]);

  const totalNotes = Object.keys(notes).length;
  const totalRead  = readItems.size;
  const isMobile   = useIsMobile();
  const [topbarPanel, setTopbarPanel] = useState(null);
  const topbarPanelRef = useRef(null);
  useEffect(() => {
    if (!topbarPanel) return;
    function handleClick(e) {
      if (topbarPanelRef.current && !topbarPanelRef.current.contains(e.target)) setTopbarPanel(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [topbarPanel]);

  if (!authReady) return <div style={{ ...F, height:"100vh", background:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:"12.5px", color:"#B45309", letterSpacing:"0.15em", textTransform:"uppercase" }}>Loading…</span></div>;
  if (recovering)  return <SetPasswordScreen onDone={() => setRecovering(false)} />;
  if (!user) return <LoginScreen />;
  if (!loaded) return <div style={{ ...F, height:"100vh", background:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:"12.5px", color:"#B45309", letterSpacing:"0.15em", textTransform:"uppercase" }}>Loading…</span></div>;

  return (
    <div style={{ height:"100vh", background:"#FFFFFF", color:"#1C1410", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Top bar */}
      <div style={{ height:"44px", background:"#FAFAF8", borderBottom:"1px solid rgba(194,65,12,0.35)", display:"flex", alignItems:"center", paddingLeft:"18px", paddingRight:"18px", flexShrink:0, gap:"16px", backdropFilter:"blur(4px)", zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#C2410C" }} />
          <span style={{ ...F, fontSize:"12.5px", color:"#1C1410", letterSpacing:"0.12em", textTransform:"uppercase" }}>Plot Twists</span>
        </div>
        {!isMobile && (
          <>
            <div style={{ height:"100%", borderLeft:"1px solid rgba(194,65,12,0.50)", marginLeft:"4px" }} />
            <TabBar active={tab} onChange={setTab} />
          </>
        )}
        <div ref={topbarPanelRef} style={{ marginLeft:"auto", display:"flex", gap:"14px", alignItems:"center", position:"relative" }}>
          {!isMobile && totalRead > 0  && <button onClick={() => setTopbarPanel(v => v==="read"  ? null : "read")}  style={{ ...F, background:"none", border:"none", cursor:"pointer", fontSize:"12.5px", color: topbarPanel==="read"  ?"#C2410C":"#B45309", textDecoration: topbarPanel==="read"  ?"underline":"none", padding:0 }}>{totalRead} read</button>}
          {!isMobile && totalNotes > 0 && <button onClick={() => setTopbarPanel(v => v==="notes" ? null : "notes")} style={{ ...F, background:"none", border:"none", cursor:"pointer", fontSize:"12.5px", color: topbarPanel==="notes" ?"#DB2777":"#B45309", textDecoration: topbarPanel==="notes" ?"underline":"none", padding:0 }}>{totalNotes} notes</button>}
          <button onClick={() => supabase.auth.signOut()} style={{ ...NAV, fontSize:"11.5px", width:"auto", padding:"0 8px", letterSpacing:"0.06em" }}>Sign out</button>
          {topbarPanel && (() => {
            const items = topbarPanel === "read"
              ? pool.filter(i => readItems.has(i.url))
              : pool.filter(i => notes[i.url] && (notes[i.url].argument || notes[i.url].thoughts || notes[i.url].quote));
            return (
              <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, width:"340px", maxHeight:"420px", overflowY:"auto", background:"#FAFAF8", border:"1px solid rgba(194,65,12,0.50)", borderRadius:"4px", boxShadow:"0 4px 18px rgba(43,45,66,0.08)", zIndex:200 }}>
                <div style={{ padding:"10px 14px 8px", borderBottom:"1px solid rgba(194,65,12,0.22)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"10.5px", color:"#B45309", letterSpacing:"0.12em", textTransform:"uppercase" }}>{topbarPanel === "read" ? "Read" : "Notes"} · {items.length} item{items.length!==1?"s":""}</span>
                  <button onClick={() => setTopbarPanel(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#B45309", fontSize:"15.5px", lineHeight:1, padding:0 }}>×</button>
                </div>
                {items.length === 0 && <div style={{ padding:"18px 14px", fontSize:"12.5px", color:"#B45309", fontStyle:"italic" }}>Nothing here yet.</div>}
                {items.map(item => {
                  const note = notes[item.url];
                  return (
                    <div key={item.url} style={{ padding:"9px 14px", borderBottom:"1px solid rgba(194,65,12,0.28)" }}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:"12.5px", color:"#1C1410", textDecoration:"none", display:"block", lineHeight:1.4, marginBottom:"3px", fontWeight:500 }}>{item.title} ↗</a>
                      <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
                        <span style={{ fontSize:"11.5px", color: COLOR[item.theme]||"#B45309", letterSpacing:"0.07em", textTransform:"uppercase" }}>{item.theme}</span>
                        <span style={{ fontSize:"11.5px", color:"#B45309", fontStyle:"italic" }}>{item.source}</span>
                      </div>
                      {topbarPanel === "notes" && note?.argument && <div style={{ fontSize:"12.5px", color:"#1C1410", lineHeight:1.5, marginTop:"5px", borderLeft:"2px solid rgba(194,65,12,0.55)", paddingLeft:"7px" }}>{note.argument.slice(0,120)}{note.argument.length>120?"…":""}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Subtitle strip */}
      <div style={{ height:"26px", background:"#FAFAF8", borderBottom:"1px solid rgba(194,65,12,0.15)", display:"flex", alignItems:"center", paddingLeft:"18px", flexShrink:0 }}>
        {TAB_SUBTITLES[tab] && <span style={{ ...F, fontSize:"10px", letterSpacing:"0.18em", textTransform:"uppercase", color:"#B45309", fontStyle:"italic" }}>{TAB_SUBTITLES[tab]}</span>}
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY: tab==="garden"||tab==="dispatch"?"hidden":"auto", overflowX:"hidden", position:"relative", paddingBottom: isMobile ? "56px" : 0 }}>
        {tab === "dispatch" && <DispatchView pool={pool} readItems={readItems} onToggleRead={toggleRead} notes={notes} onSaveNote={saveNote} paths={paths} orgs={orgs} orgLinks={orgLinks} onSavePath={savePath} onSaveOrgLink={saveOrgLink} onDeleteOrgLink={deleteOrgLink} onRemove={removeFromPool} />}
        {tab === "garden"   && <GardenView   pool={pool} readItems={readItems} onToggleRead={toggleRead} notes={notes} onSaveNote={saveNote} onRemove={removeFromPool} paths={paths} onSavePath={savePath} onDeletePath={deletePath} orgs={orgs} orgLinks={orgLinks} onSaveOrgLink={saveOrgLink} onDeleteOrgLink={deleteOrgLink} customThemeColors={customThemeColors} />}
        {tab === "paths"    && <PathsView    paths={paths} pool={pool} notes={notes} readItems={readItems} onToggleRead={toggleRead} onOpenNote={node => { saveNote(node); }} onRemove={removeFromPool} onSavePath={savePath} orgs={orgs} orgLinks={orgLinks} onSaveOrgLink={saveOrgLink} onDeleteOrgLink={deleteOrgLink} />}
        {tab === "field"    && <FieldView    orgs={orgs} orgLinks={orgLinks} pool={pool} onSaveOrg={saveOrg} onDeleteOrg={deleteOrg} onSaveOrgLink={saveOrgLink} onDeleteOrgLink={deleteOrgLink} />}
        {tab === "stats"    && <StatsView    pool={pool} readItems={readItems} notes={notes} />}
        {tab === "add"      && <AddSourceView pool={pool} onAdd={addItem} onDelete={deleteItem} hiddenIds={hiddenIds} allBuiltin={BUILTIN} onHide={hideItem} onRestore={restoreItem} onSaveThemeColor={saveThemeColor} />}
      </div>

      {isMobile && <BottomTabBar active={tab} onChange={setTab} />}
    </div>
  );
}
