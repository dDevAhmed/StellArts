"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/ui/Navbar";
import Footer from "../../components/ui/Footer";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { api, type ArtisanItem } from "../../lib/api";
import { MapPin, Star, Sparkles, Filter, AlertCircle, ChevronLeft, ChevronRight, Briefcase, DollarSign, Clock, Search } from "lucide-react";
import Price from "../../components/ui/Price";
import ArtisanMap from "../../components/map";

const DEFAULT_LAT = 51.5074;
const DEFAULT_LON = -0.1278;

function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return <div className={`skeleton-shimmer rounded-full ${className}`} aria-hidden="true" />;
}

function ArtisanSkeletonCard() {
  return (
    <Card className="h-full overflow-hidden border-gray-200 bg-white/90 shadow-sm">
      <CardContent className="p-5">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="skeleton-shimmer h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2.5 pt-1">
              <SkeletonBlock className="h-4 w-2/3 rounded-md" />
              <SkeletonBlock className="h-3 w-1/2 rounded-md" />
              <SkeletonBlock className="h-3 w-1/3 rounded-md" />
            </div>
          </div>
          <div className="space-y-3">
            <SkeletonBlock className="h-3 w-full rounded-md" />
            <SkeletonBlock className="h-3 w-5/6 rounded-md" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <SkeletonBlock className="h-5 w-20 rounded-full" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MapSkeleton() {
  return (
    <Card className="overflow-hidden border-blue-100 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="relative h-[320px] overflow-hidden bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_45%,#f8fafc_100%)]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute inset-0 skeleton-wave opacity-70" />
          <div className="absolute left-6 top-6 w-[calc(100%-3rem)] rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <SkeletonBlock className="mb-3 h-4 w-28 rounded-md" />
            <SkeletonBlock className="h-3 w-40 rounded-md" />
          </div>
          <div className="absolute left-[18%] top-[36%] h-4 w-4 rounded-full bg-white/70 shadow-[0_0_0_6px_rgba(255,255,255,0.35)]" />
          <div className="absolute left-[46%] top-[52%] h-5 w-5 rounded-full bg-white/80 shadow-[0_0_0_8px_rgba(255,255,255,0.32)]" />
          <div className="absolute left-[68%] top-[30%] h-3.5 w-3.5 rounded-full bg-white/70 shadow-[0_0_0_6px_rgba(255,255,255,0.3)]" />
          <div className="absolute bottom-6 left-6 right-6 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl bg-white/75 p-3 shadow-sm backdrop-blur-sm">
                <SkeletonBlock className="mb-2 h-3 w-16 rounded-md" />
                <SkeletonBlock className="h-3 w-12 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArtisanMapPanel({
  artisans,
  loading,
  hasResults,
  userLat,
  userLon,
}: {
  artisans: ArtisanItem[];
  loading: boolean;
  hasResults: boolean;
  userLat: number | null;
  userLon: number | null;
}) {
  if (loading && !hasResults) {
    return <MapSkeleton />;
  }

  const center: [number, number] = userLat && userLon ? [userLat, userLon] : [DEFAULT_LAT, DEFAULT_LON];

  return (
    <Card className="overflow-hidden border-blue-100 bg-white shadow-sm flex flex-col">
      <CardContent className="p-0 flex-1 relative min-h-[320px]">
        <ArtisanMap 
          artisans={artisans} 
          center={center} 
          zoom={13} 
        />
        
        {loading && (
          <div className="absolute inset-0 z-20 bg-white/20 backdrop-blur-[1px] pointer-events-none transition-opacity duration-300">
            <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                Updating...
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function specialtyLabel(artisan: ArtisanItem) {
  const s = artisan.specialties;
  if (Array.isArray(s)) return s[0] ?? "Artisan";
  if (typeof s === "string") return s;
  return "Artisan";
}

export default function ArtisansPage() {
  const [artisans, setArtisans] = useState<ArtisanItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Filters
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [minExperience, setMinExperience] = useState<number | "">("");
  const [isAvailable, setIsAvailable] = useState(false);

  const [debouncedFilters, setDebouncedFilters] = useState({
    specialties,
    minRating,
    maxPrice,
    minExperience,
    isAvailable,
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters({
        specialties,
        minRating,
        maxPrice,
        minExperience,
        isAvailable,
      });
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [specialties, minRating, maxPrice, minExperience, isAvailable]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLat(DEFAULT_LAT);
      setLon(DEFAULT_LON);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
      },
      () => {
        setLat(DEFAULT_LAT);
        setLon(DEFAULT_LON);
      }
    );
  }, []);

  useEffect(() => {
    if (lat === null || lon === null) return;

    setLoading(true);
    setError("");

    api.artisans
      .nearby(lat, lon, {
        page,
        page_size: pageSize,
        specialties: debouncedFilters.specialties.length
          ? debouncedFilters.specialties
          : undefined,
        min_rating: debouncedFilters.minRating || undefined,
        max_price:
          debouncedFilters.maxPrice !== ""
            ? Number(debouncedFilters.maxPrice)
            : undefined,
        min_experience:
          debouncedFilters.minExperience !== ""
            ? Number(debouncedFilters.minExperience)
            : undefined,
        is_available: debouncedFilters.isAvailable || undefined,
      })
      .then((res) => {
        setArtisans(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load artisans");
      })
      .finally(() => setLoading(false));
  }, [lat, lon, page, debouncedFilters]);

  const clearFilters = () => {
    setSpecialties([]);
    setMinRating(0);
    setMaxPrice("");
    setMinExperience("");
    setIsAvailable(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <Navbar />

      <main className="pt-28 pb-20 px-4 max-w-7xl mx-auto">
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
            Find an Artisan
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto md:mx-0">
            Connect with verified professionals in your area ready to tackle your next project.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Enhanced Sidebar Filters */}
          <aside className="w-full lg:w-80 shrink-0 bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/40 sticky top-28">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-500" /> Filters
              </h2>
              <Button onClick={clearFilters} variant="ghost" size="sm" className="text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 h-8">
                Reset
              </Button>
            </div>

            <div className="space-y-7">
              {/* Specialties Filter */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-slate-400" /> Specialties
                </p>
                <div className="space-y-2.5">
                  {["Plumber", "Electrician", "Carpenter", "Painter", "Mechanic"].map((s) => (
                    <label key={s} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer appearance-none w-5 h-5 border-2 border-slate-200 rounded-md checked:bg-indigo-500 checked:border-indigo-500 transition-all"
                          checked={specialties.includes(s)}
                          onChange={(e) =>
                            e.target.checked
                              ? setSpecialties([...specialties, s])
                              : setSpecialties(specialties.filter((x) => x !== s))
                          }
                        />
                        <svg className="absolute w-3 h-3 text-white left-1 top-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="text-slate-600 text-sm group-hover:text-indigo-600 transition-colors">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Min Rating Filter */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Star className="w-4 h-4 text-slate-400" /> Minimum Rating
                  </p>
                  <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">{minRating} ★</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>Any</span>
                  <span>5 Stars</span>
                </div>
              </div>

              {/* Max Price & Min Experience */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-slate-400" /> Max /hr
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Any"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : "")}
                      className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" /> Yrs Exp.
                  </p>
                  <input
                    type="number"
                    placeholder="Any"
                    value={minExperience}
                    onChange={(e) => setMinExperience(e.target.value ? Number(e.target.value) : "")}
                    className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Availability Filter */}
              <label className="flex items-center gap-3 cursor-pointer group p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-colors">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-full checked:bg-green-500 checked:border-green-500 transition-all"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                  />
                  <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-700 text-sm font-medium">Available Now</span>
                  <span className="text-slate-400 text-xs">Ready for immediate hire</span>
                </div>
              </label>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Error State */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold">Unable to fetch artisans</h3>
                  <p className="text-sm opacity-90">{error}</p>
                </div>
              </div>
            )}

            {/* Content Display */}
            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ArtisanSkeletonCard key={i} />
                ))}
              </div>
            ) : artisans.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 min-h-[400px]">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No artisans found</h3>
                <p className="text-slate-500 max-w-sm mb-6">
                  We couldn&apos;t find any professionals matching your specific filters. Try broadening your search criteria.
                </p>
                <Button onClick={clearFilters} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 shadow-md shadow-indigo-200">
                  Reset All Filters
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {artisans.map((a) => (
                    <Link key={a.id} href={`/artisans/${a.id}`} className="group outline-none">
                      <Card className="h-full overflow-hidden border-slate-200/60 bg-white transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1 hover:border-indigo-200 group-focus-visible:ring-2 group-focus-visible:ring-indigo-500 rounded-2xl">
                        <CardContent className="p-0">
                          {/* Card Header with gradient background pattern */}
                          <div className="h-16 bg-gradient-to-r from-blue-50 to-indigo-50/50 relative overflow-hidden border-b border-slate-100/50">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
                            {a.is_available && (
                              <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm border border-green-100 shadow-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Available</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="px-5 pb-5 pt-2 relative">
                            {/* Avatar placeholder overlapping header */}
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center -mt-8 mb-3 overflow-hidden">
                              <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-400 font-bold text-lg">
                                {(a.business_name || specialtyLabel(a)).charAt(0).toUpperCase()}
                              </div>
                            </div>
                            
                            <h2 className="font-bold text-slate-800 text-lg mb-1 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                              {a.business_name || "Independent Artisan"}
                            </h2>
                            <p className="text-sm font-medium text-indigo-600 mb-3 bg-indigo-50 inline-block px-2.5 py-0.5 rounded-md">
                              {specialtyLabel(a)}
                            </p>
                            
                            <div className="space-y-2 mb-4">
                              <p className="text-sm text-slate-500 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="truncate">{a.location || "Location not specified"}</span>
                              </p>
                              <div className="flex items-center gap-2">
                                <Star className={`w-4 h-4 shrink-0 ${a.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                                <span className="text-sm font-medium text-slate-700">
                                  {a.rating ? a.rating.toFixed(1) : "New"}
                                </span>
                                {a.total_reviews ? (
                                  <span className="text-xs text-slate-400">({a.total_reviews} reviews)</span>
                                ) : null}
                              </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 flex items-end justify-between">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-400 font-medium mb-0.5">Hourly Rate</span>
                                {a.hourly_rate ? (
                                  <span className="font-bold text-slate-800 flex items-baseline gap-0.5">
                                    <Price amount={Number(a.hourly_rate)} />
                                    <span className="text-xs font-normal text-slate-500">/hr</span>
                                  </span>
                                ) : (
                                  <span className="text-sm font-medium text-slate-600">Contact for quote</span>
                                )}
                              </div>
                              <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {total > pageSize && (
                  <div className="flex justify-center items-center gap-6 mt-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <Button 
                      variant="outline"
                      disabled={page <= 1} 
                      onClick={() => setPage(page - 1)}
                      className="rounded-xl border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <div className="flex items-center gap-1.5 font-medium text-sm text-slate-500">
                      Page <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{page}</span> of {Math.ceil(total / pageSize)}
                    </div>
                    <Button
                      variant="outline"
                      disabled={page >= Math.ceil(total / pageSize)}
                      onClick={() => setPage(page + 1)}
                      className="rounded-xl border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Map Section */}
            <div className="mt-8 relative z-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-500" /> View on Map
                </h3>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-200/60 ring-1 ring-black/5 bg-white">
                <ArtisanMapPanel
                  artisans={artisans}
                  loading={loading}
                  hasResults={artisans.length > 0}
                  userLat={lat}
                  userLon={lon}
                />
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}