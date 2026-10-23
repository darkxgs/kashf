// Naseem is a made-up store. It exists so Kashf always has a store to check,
// and it carries some deliberate problems so the report has things to say.
export const PRODUCTS = [
  { slug: "amber-crystal", name: "عنبر كريستال", en: "Amber Crystal", price: 289, img: "/demo-store/img/amber-crystal.webp", alt: "زجاجة عطر كريستالية بغطاء ذهبي", note: "عنبر دافئ مع لمسة فانيلا وخشب الصندل." },
  { slug: "oud-roller", name: "دهن عود ملكي", en: "Royal Oud Oil", price: 349, img: "/demo-store/img/oud-roller.jpg", alt: "", note: "دهن عود مركّز في عبوة سهلة الحمل، ثباته يدوم طوال اليوم." },
  { slug: "white-mabkhara", name: "مبخرة بيضاء", en: "White Mabkhara", price: 159, img: "/demo-store/img/mabkhara.webp", alt: "مبخرة خزفية بيضاء", note: "مبخرة خزفية بتصميم بسيط، مناسبة للبخور والعود." },
  { slug: "gift-set", name: "طقم هدية نسيم", en: "Naseem Gift Set", price: 399, img: "/demo-store/img/gift-set.webp", alt: "", note: "عطران في علبة هدية مبطّنة بالساتان، جاهزة للإهداء." },
] as const;

export type Product = (typeof PRODUCTS)[number];
