import { notFound } from "next/navigation";

const PAGES: Record<string, { title: string; body: string }> = {
  shipping: { title: "الشحن والتوصيل", body: "نوصل لكل مدن المملكة خلال يومين إلى أربعة أيام عمل. الشحن مجاني للطلبات فوق 300 ريال." },
  privacy: { title: "سياسة الخصوصية", body: "نستخدم بياناتك لتوصيل طلبك فقط، ولا نشاركها مع أي جهة أخرى." },
};

export async function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}

export default async function DemoPage({ params }: PageProps<"/demo-store/pages/[page]">) {
  const { page } = await params;
  const p = PAGES[page];
  if (!p) notFound();
  return (
    <main className="mx-auto max-w-2xl px-5 pt-6">
      <h1 className="text-[32px] font-semibold">{p.title}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-[#6b5a48]">{p.body}</p>
    </main>
  );
}
