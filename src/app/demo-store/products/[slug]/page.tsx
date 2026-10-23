import { notFound } from "next/navigation";
import { PRODUCTS } from "../../data";

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export default async function DemoProduct({ params }: PageProps<"/demo-store/products/[slug]">) {
  const { slug } = await params;
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) notFound();
  // Product data without a price: Google can't show one in results (on purpose).
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: p.name, image: p.img, offers: { "@type": "Offer", availability: "https://schema.org/InStock" } };
  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-5 pt-6 lg:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <img src={p.img} alt={p.alt} className="aspect-square w-full rounded-3xl object-cover" />
      <div>
        <h1 className="text-[36px] font-semibold">{p.name}</h1>
        <p className="mt-2 text-[22px]">{p.price} ر.س</p>
        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#6b5a48]">{p.note}</p>
        <button type="button" className="mt-8 rounded-full bg-[#2b2118] px-8 py-3.5 text-[16px] text-[#f3e9dc]">
          أضف إلى السلة
        </button>
        <p className="mt-6 text-[14px] text-[#6b5a48]">الشحن خلال يومين إلى أربعة أيام.</p>
      </div>
    </main>
  );
}
