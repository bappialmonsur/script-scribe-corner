import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";
import { Download, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getPdfDownloadUrl } from "@/lib/site.functions";
import { bnClass, bnNum } from "@/lib/grading";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "সমীকরণ শিক্ষা পরিবার — মেধা গড়ার বিশ্বস্ত ঠিকানা" },
      {
        name: "description",
        content:
          "সমীকরণ শিক্ষা পরিবার — SSC, HSC ও বিশ্ববিদ্যালয় ভর্তি প্রস্তুতির জন্য দেশের অন্যতম নির্ভরযোগ্য কোচিং সেন্টার।",
      },
      { property: "og:title", content: "সমীকরণ শিক্ষা পরিবার" },
      { property: "og:description", content: "মেধা ও নিষ্ঠার সমন্বয়ে গড়ি আগামীর কারিগর।" },
    ],
    links: [{
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
    }],
  }),
  component: Index,
});

const SITE_BUCKET = "site-assets";
function publicUrl(path: string) {
  const { data } = supabase.storage.from(SITE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function Index() {
  const { data: hero } = useQuery({
    queryKey: ["pub-hero"],
    queryFn: async () => (await supabase.from("hero_slides").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });
  const { data: courses } = useQuery({
    queryKey: ["pub-courses"],
    queryFn: async () => (await supabase.from("courses").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });
  const { data: pdfs } = useQuery({
    queryKey: ["pub-pdfs"],
    queryFn: async () => (await supabase.from("pdf_notes").select("*").eq("is_active", true).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: gallery } = useQuery({
    queryKey: ["pub-gallery"],
    queryFn: async () => (await supabase.from("gallery_images").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });

  const getUrl = useServerFn(getPdfDownloadUrl);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDownload = async (id: string) => {
    setLoadingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("ডাউনলোডের জন্য আগে লগইন করুন");
        window.location.href = "/login";
        return;
      }
      const res = await getUrl({ data: { noteId: id } });
      window.open(res.url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "ডাউনলোড ব্যর্থ");
    } finally { setLoadingId(null); }
  };

  return (
    <div className="min-h-screen bg-academy-soft text-academy-navy">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-academy-navy/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-10 bg-academy-navy rounded flex items-center justify-center">
              <span className="text-academy-gold font-bold text-xl">Σ</span>
            </div>
            <span className="text-base md:text-xl font-bold tracking-tight">সমীকরণ শিক্ষা পরিবার</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-medium text-sm">
            <a href="#home" className="hover:text-academy-gold">হোম</a>
            <a href="#courses" className="hover:text-academy-gold">কোর্সসমূহ</a>
            <a href="#books" className="hover:text-academy-gold">পিডিএফ নোটস</a>
            <a href="#gallery" className="hover:text-academy-gold">গ্যালারি</a>
            <a href="#contact" className="hover:text-academy-gold">যোগাযোগ</a>
            <a href="/admin" className="text-academy-navy/70 hover:text-academy-gold">এডমিন</a>
            <a href="/login" className="bg-academy-navy text-white px-6 py-2.5 rounded-full hover:bg-academy-gold">লগইন</a>
          </div>
          <div className="flex md:hidden items-center gap-2 text-sm font-medium">
            <a href="/admin" className="px-3 py-2 rounded-full border border-academy-navy/20">এডমিন</a>
            <a href="/login" className="bg-academy-navy text-white px-4 py-2 rounded-full">লগইন</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="home" className="pt-8 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {hero && hero.length > 0 ? (
            <Carousel opts={{ loop: true }} className="relative">
              <CarouselContent>
                {hero.map((s) => (
                  <CarouselItem key={s.id}>
                    <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                      <img src={publicUrl(s.image_path)} alt={s.title} className="w-full aspect-[16/9] object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-academy-navy/90 via-academy-navy/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 text-white">
                        {s.badge && (
                          <div className="inline-block px-3 py-1 rounded-full bg-academy-gold text-academy-navy text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3">
                            {s.badge}
                          </div>
                        )}
                        <h2 className="text-xl md:text-5xl font-bold mb-2 max-w-3xl">{s.title}</h2>
                        {s.subtitle && <p className="text-xs md:text-lg text-white/80 max-w-2xl">{s.subtitle}</p>}
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 size-10 md:size-12 bg-white/90 hover:bg-academy-gold hover:text-white border-0" />
              <CarouselNext className="right-4 size-10 md:size-12 bg-white/90 hover:bg-academy-gold hover:text-white border-0" />
            </Carousel>
          ) : (
            <div className="aspect-[16/9] rounded-3xl bg-academy-navy/5 flex items-center justify-center text-muted-foreground">
              এডমিন প্যানেল থেকে ব্যানার যোগ করুন
            </div>
          )}
        </div>
      </section>

      {/* COURSES */}
      <section id="courses" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">আমাদের কোর্সসমূহ</h2>
            <p className="text-muted-foreground">আপনার লক্ষ্য অর্জনে সঠিক বিভাগটি বেছে নিন</p>
            <div className="h-1.5 w-20 bg-academy-gold mt-4 rounded-full" />
          </div>
          {courses && courses.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((c) => (
                <div key={c.id} className="bg-academy-soft rounded-2xl overflow-hidden border hover:shadow-2xl hover:-translate-y-1 transition-all">
                  {c.image_path && <img src={publicUrl(c.image_path)} alt={c.title} className="w-full aspect-video object-cover" />}
                  <div className="p-8">
                    {c.tag && <span className="text-xs font-bold text-academy-gold uppercase tracking-tighter">{c.tag}</span>}
                    <h3 className="text-2xl font-bold mt-2 mb-3">{c.title}</h3>
                    {c.description && <p className="text-sm text-muted-foreground mb-4">{c.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
                      {c.class_level && <span>{bnClass(c.class_level)} শ্রেণি</span>}
                      {c.duration && <><span>•</span><span>{c.duration}</span></>}
                      {c.fee && <><span>•</span><span className="font-bold text-academy-navy">{c.fee}</span></>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">কোনো কোর্স এখনো যোগ করা হয়নি।</p>
          )}
        </div>
      </section>

      {/* PDF NOTES */}
      <section id="books" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-academy-gold uppercase tracking-widest">শ্রেণিভিত্তিক</span>
            <h2 className="text-3xl lg:text-4xl font-bold mt-3 mb-4">পিডিএফ নোটস</h2>
            <p className="text-muted-foreground">লগইন করে নিজের শ্রেণির নোট ডাউনলোড করুন।</p>
            <div className="h-1.5 w-20 bg-academy-gold mx-auto mt-6 rounded-full" />
          </div>
          {pdfs && pdfs.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {pdfs.map((b) => (
                <div key={b.id} className="group bg-white rounded-2xl p-6 border hover:border-academy-gold/40 hover:shadow-xl transition-all flex flex-col">
                  <div className="relative mb-6">
                    <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-academy-navy to-academy-navy/80 p-5 flex flex-col justify-between text-white shadow-lg">
                      <FileText className="size-7 text-academy-gold" />
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-academy-gold/80 mb-1">
                          {bnClass(b.class_level)} শ্রেণি {b.subject ? `• ${b.subject}` : ""}
                        </div>
                        <div className="text-base font-bold leading-tight">{b.title}</div>
                      </div>
                    </div>
                  </div>
                  <h3 className="font-bold mb-2">{b.title}</h3>
                  <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
                    {b.pages && <><span>{bnNum(b.pages)} পৃষ্ঠা</span><span>•</span></>}
                    {b.file_size_kb && <span>{(b.file_size_kb/1024).toFixed(1)} MB</span>}
                  </div>
                  <button
                    onClick={() => handleDownload(b.id)}
                    disabled={loadingId === b.id}
                    className="mt-auto w-full py-2.5 bg-academy-soft text-academy-navy font-bold text-sm rounded-lg hover:bg-academy-navy hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loadingId === b.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    ডাউনলোড করুন
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">এখনো কোনো পিডিএফ নোট যোগ করা হয়নি।</p>
          )}
        </div>
      </section>

      {/* GALLERY */}
      {gallery && gallery.length > 0 && (
        <section id="gallery" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">গ্যালারি</h2>
              <div className="h-1.5 w-20 bg-academy-gold mx-auto rounded-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gallery.map((g) => (
                <div key={g.id} className="rounded-xl overflow-hidden border">
                  <img src={publicUrl(g.image_path)} alt={g.caption ?? ""} className="w-full aspect-square object-cover hover:scale-105 transition-transform" />
                  {g.caption && <div className="p-2 text-xs text-center">{g.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer id="contact" className="bg-academy-navy text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 border-b border-white/10 pb-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="size-8 bg-academy-gold rounded flex items-center justify-center">
                  <span className="text-academy-navy font-bold">Σ</span>
                </div>
                <span className="text-2xl font-bold">সমীকরণ শিক্ষা পরিবার</span>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed">
                আমাদের লক্ষ্য শিক্ষার্থীদের ভিত্তি মজবুত করা এবং তাদের সুপ্ত প্রতিভাকে জাগ্রত করে উন্নত ক্যারিয়ার গঠনে সহযোগিতা করা।
              </p>
            </div>
            <div>
              <h5 className="text-lg font-bold mb-6">দ্রুত লিংক</h5>
              <ul className="space-y-4 text-slate-400 text-sm">
                <li><a href="#courses" className="hover:text-academy-gold">কোর্সসমূহ</a></li>
                <li><a href="#books" className="hover:text-academy-gold">পিডিএফ নোটস</a></li>
                <li><a href="#gallery" className="hover:text-academy-gold">গ্যালারি</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-lg font-bold mb-6">যোগাযোগ</h5>
              <ul className="space-y-4 text-slate-400 text-sm">
                <li>৭৪, দক্ষিণ বাসাবো, গাজী বাড়ি, সবুজবাগ, ঢাকা।</li>
                <li><a href="tel:+8801920746162" className="hover:text-academy-gold">মোবাইল: ০১৯২০-৭৪৬১৬২</a></li>
              </ul>
            </div>
          </div>
          <div className="text-xs text-slate-500 text-center">© ২০২৫ সমীকরণ শিক্ষা পরিবার।</div>
        </div>
      </footer>
    </div>
  );
}
