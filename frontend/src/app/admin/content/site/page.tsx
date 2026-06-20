'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getHomeContent,
  saveHomeContent,
  getAboutContent,
  saveAboutContent,
  defaultHomeContent,
  defaultAboutContent,
  type FeatureItem,
  type QualificationPathItem,
  type PillarItem,
  type ValueItem,
  type FeatureIconKey,
  type PillarIconKey,
  type ValueIconKey,
} from '@/lib/site-content-data';

const featureIconOptions: FeatureIconKey[] = ['BrainCircuit', 'BookOpen', 'CalendarCheck', 'GraduationCap'];
const pillarIconOptions: PillarIconKey[] = ['Users', 'BookOpen', 'GraduationCap'];
const valueIconOptions: ValueIconKey[] = ['Target', 'Award', 'TrendingUp'];

export default function SiteContentPage() {
  const { toast } = useToast();

  // Home content state
  const [features, setFeatures] = useState<FeatureItem[]>(defaultHomeContent.features);
  const [qualificationPath, setQualificationPath] = useState<QualificationPathItem[]>(
    defaultHomeContent.qualificationPath,
  );
  const [isSavingHome, setIsSavingHome] = useState(false);

  // About content state
  const [pillars, setPillars] = useState<PillarItem[]>(defaultAboutContent.pillars);
  const [values, setValues] = useState<ValueItem[]>(defaultAboutContent.values);
  const [isSavingAbout, setIsSavingAbout] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [home, about] = await Promise.all([getHomeContent(), getAboutContent()]);
      setFeatures(home.features);
      setQualificationPath(home.qualificationPath);
      setPillars(about.pillars);
      setValues(about.values);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load site content' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ── Home save ──────────────────────────────────────────────────────────────
  const handleSaveHome = async () => {
    setIsSavingHome(true);
    try {
      await saveHomeContent({ features, qualificationPath });
      toast({ title: 'Homepage content saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not write homepage content.' });
    } finally {
      setIsSavingHome(false);
    }
  };

  // ── About save ─────────────────────────────────────────────────────────────
  const handleSaveAbout = async () => {
    setIsSavingAbout(true);
    try {
      await saveAboutContent({ pillars, values });
      toast({ title: 'About page content saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not write about page content.' });
    } finally {
      setIsSavingAbout(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Site Content</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage the public-facing copy on the Homepage and About page without a code deploy.
        </p>
      </div>

      <Tabs defaultValue="home">
        <TabsList>
          <TabsTrigger value="home">Homepage</TabsTrigger>
          <TabsTrigger value="about">About Page</TabsTrigger>
        </TabsList>

        {/* ── HOMEPAGE TAB ──────────────────────────────────────────────── */}
        <TabsContent value="home" className="space-y-6 mt-6">

          {/* Features section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why Choose Us — Feature Cards</CardTitle>
              <CardDescription>
                Four cards shown in the "Built for professionals" section on the homepage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {features.map((f, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Feature {f.number}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setFeatures(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Number</Label>
                      <Input
                        value={f.number}
                        onChange={e =>
                          setFeatures(prev =>
                            prev.map((item, idx) => idx === i ? { ...item, number: e.target.value } : item),
                          )
                        }
                        placeholder="01"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Icon</Label>
                      <Select
                        value={f.iconKey}
                        onValueChange={v =>
                          setFeatures(prev =>
                            prev.map((item, idx) =>
                              idx === i ? { ...item, iconKey: v as FeatureIconKey } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {featureIconOptions.map(k => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={f.title}
                      onChange={e =>
                        setFeatures(prev =>
                          prev.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item),
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={f.description}
                      rows={2}
                      onChange={e =>
                        setFeatures(prev =>
                          prev.map((item, idx) =>
                            idx === i ? { ...item, description: e.target.value } : item,
                          ),
                        )
                      }
                      className="text-sm resize-none"
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setFeatures(prev => [
                    ...prev,
                    {
                      number: String(prev.length + 1).padStart(2, '0'),
                      iconKey: 'BookOpen',
                      title: 'New Feature',
                      description: '',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add Feature
              </Button>
            </CardContent>
          </Card>

          {/* Qualification Path section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Qualification Journey Panel</CardTitle>
              <CardDescription>
                Levels shown in the hero right-panel on the homepage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qualificationPath.map((q, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Level {i + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setQualificationPath(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Code</Label>
                      <Input
                        value={q.code}
                        onChange={e =>
                          setQualificationPath(prev =>
                            prev.map((item, idx) => idx === i ? { ...item, code: e.target.value } : item),
                          )
                        }
                        placeholder="L1"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={q.name}
                        onChange={e =>
                          setQualificationPath(prev =>
                            prev.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item),
                          )
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Subtitle</Label>
                      <Input
                        value={q.subtitle}
                        onChange={e =>
                          setQualificationPath(prev =>
                            prev.map((item, idx) => idx === i ? { ...item, subtitle: e.target.value } : item),
                          )
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Switch
                        id={`qual-available-${i}`}
                        checked={q.available}
                        onCheckedChange={v =>
                          setQualificationPath(prev =>
                            prev.map((item, idx) => idx === i ? { ...item, available: v } : item),
                          )
                        }
                      />
                      <Label htmlFor={`qual-available-${i}`} className="text-xs">Available</Label>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setQualificationPath(prev => [
                    ...prev,
                    { code: 'NEW', name: 'New Level', subtitle: '', available: false },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add Level
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSaveHome} disabled={isSavingHome} className="gap-2">
              {isSavingHome ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Homepage Content
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setFeatures(defaultHomeContent.features);
                setQualificationPath(defaultHomeContent.qualificationPath);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset to Defaults
            </Button>
          </div>
        </TabsContent>

        {/* ── ABOUT PAGE TAB ────────────────────────────────────────────── */}
        <TabsContent value="about" className="space-y-6 mt-6">

          {/* Pillars section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What We Stand For — Pillars</CardTitle>
              <CardDescription>
                Three cards shown in the "What We Stand For" section on the About page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pillars.map((p, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Pillar {p.number}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setPillars(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Number</Label>
                      <Input
                        value={p.number}
                        onChange={e =>
                          setPillars(prev =>
                            prev.map((item, idx) => idx === i ? { ...item, number: e.target.value } : item),
                          )
                        }
                        placeholder="01"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Icon</Label>
                      <Select
                        value={p.iconKey}
                        onValueChange={v =>
                          setPillars(prev =>
                            prev.map((item, idx) =>
                              idx === i ? { ...item, iconKey: v as PillarIconKey } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pillarIconOptions.map(k => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={p.title}
                      onChange={e =>
                        setPillars(prev =>
                          prev.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item),
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      value={p.body}
                      rows={2}
                      onChange={e =>
                        setPillars(prev =>
                          prev.map((item, idx) =>
                            idx === i ? { ...item, body: e.target.value } : item,
                          ),
                        )
                      }
                      className="text-sm resize-none"
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setPillars(prev => [
                    ...prev,
                    {
                      number: String(prev.length + 1).padStart(2, '0'),
                      iconKey: 'Users',
                      title: 'New Pillar',
                      body: '',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add Pillar
              </Button>
            </CardContent>
          </Card>

          {/* Values section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Our Values</CardTitle>
              <CardDescription>
                Three cards shown in the "Our Values" section on the About page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {values.map((v, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Value {i + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setValues(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Icon</Label>
                      <Select
                        value={v.iconKey}
                        onValueChange={vk =>
                          setValues(prev =>
                            prev.map((item, idx) =>
                              idx === i ? { ...item, iconKey: vk as ValueIconKey } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {valueIconOptions.map(k => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={v.label}
                        onChange={e =>
                          setValues(prev =>
                            prev.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item),
                          )
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={v.desc}
                      rows={2}
                      onChange={e =>
                        setValues(prev =>
                          prev.map((item, idx) =>
                            idx === i ? { ...item, desc: e.target.value } : item,
                          ),
                        )
                      }
                      className="text-sm resize-none"
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setValues(prev => [
                    ...prev,
                    { iconKey: 'Target', label: 'New Value', desc: '' },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add Value
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSaveAbout} disabled={isSavingAbout} className="gap-2">
              {isSavingAbout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save About Page Content
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setPillars(defaultAboutContent.pillars);
                setValues(defaultAboutContent.values);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset to Defaults
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
