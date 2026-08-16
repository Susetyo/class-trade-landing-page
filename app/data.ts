export const navItems = [
  { label: "Program", href: "#program" },
  { label: "Method", href: "#method" },
  { label: "Inside The Lab", href: "#inside-the-lab" },
  { label: "Pricing", href: "#pricing" },
];

export const toolNavItems = [
  { label: "Risk Calculator", href: "/tools/risk-calculator", icon: "🧮" },
];

export const logos = ["NOVA", "APEX", "ORBIT", "MONO", "KAIRO"];

export const modules = [
  {
    number: "01",
    title: "Trading Foundation",
    body: "Memahami market, jenis aset, sesi market, dan cara berpikir trader pemula yang benar.",
  },
  {
    number: "02",
    title: "Market Structure",
    body: "Belajar membaca trend, support resistance, area likuiditas, dan perubahan struktur market.",
  },
  {
    number: "03",
    title: "Entry Framework",
    body: "Menyusun checklist entry agar keputusan trading tidak hanya berdasarkan feeling atau FOMO.",
  },
  {
    number: "04",
    title: "Risk Management",
    body: "Mengatur position sizing, risk per trade, cut loss, dan batas kerugian harian dengan realistis.",
  },
  {
    number: "05",
    title: "Trading Psychology",
    body: "Mengenali overtrade, revenge trade, bias, dan cara membangun disiplin lewat jurnal trading.",
  },
  {
    number: "06",
    title: "Trading Plan System",
    body: "Membuat sistem trading pribadi lengkap dengan rule, template jurnal, dan evaluasi mingguan.",
  },
];

export const features = [
  "Interactive live classes",
  "Session recordings",
  "Private community",
  "Trading plan templates",
  "Risk management worksheets",
  "Real-market case studies",
];

export const metrics = [
  ["53", "Total batches"],
  ["897", "Community members"],
  ["636+", "Hours of live sessions"],
];

export type PricingPlan = {
  name: string;
  description: string;
  price: string;
  originalPrice?: string;
  badge?: string;
  cta: string;
  href: string;
  features: string[];
};

export const pricingPlans: PricingPlan[] = [
  {
    name: "Core Foundation",
    description: "Perfect for new traders.",
    price: "Rp 500K",
    cta: "Join Foundation",
    href: "mailto:hello@kafeinmatcha.academy?subject=Join%20Core%20Foundation",
    features: [
      "Market structure & mapping",
      "Risk management setup",
      "Trading journal basics",
      "Private community access",
    ],
  },
  {
    name: "Advanced Edge",
    description: "Sharpen your technical edge.",
    price: "Rp 500K",
    originalPrice: "Rp 1.000.000",
    badge: "50% OFF LIMITED",
    cta: "Join Advanced",
    href: "mailto:hello@kafeinmatcha.academy?subject=Join%20Advanced%20Edge",
    features: [
      "Advanced ADX & momentum",
      "Complex market case studies",
      "Setup optimization system",
      "Priority mentor feedback",
    ],
  },
];

export const faqs = [
  {
    question: "Apakah kelas ini cocok untuk pemula total?",
    answer:
      "Ya. Materi dimulai dari dasar market, istilah penting, cara membaca chart, sampai membuat trading plan sederhana.",
  },
  {
    question: "Apakah ini grup sinyal trading?",
    answer:
      "Bukan. Program ini berfokus pada edukasi, sistem berpikir, manajemen risiko, dan disiplin trading.",
  },
  {
    question: "Apakah ada jaminan profit?",
    answer:
      "Tidak. Trading memiliki risiko kerugian. Kelas ini tidak memberikan janji profit atau rekomendasi beli/jual aset.",
  },
];
