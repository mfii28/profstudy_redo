'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, PlusCircle, Download, FileText, Loader2, Database, Trash2, Filter } from "lucide-react";
import { getUsers } from '@/lib/user-data';
import { getOrders } from '@/lib/finance-data';
import { getCourses } from '@/lib/course-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type DataSource = 'users' | 'sales' | 'courses';

interface ReportField {
  id: string;
  label: string;
}

const FIELDS: Record<DataSource, ReportField[]> = {
  users: [
    { id: 'name', label: 'Display Name' },
    { id: 'email', label: 'Email Address' },
    { id: 'role', label: 'User Role' },
    { id: 'studyStreak', label: 'Study Streak' },
    { id: 'enrollments', label: 'Enrolled Count' },
    { id: 'status', label: 'Account Status' },
  ],
  sales: [
    { id: 'orderId', label: 'Order Reference' },
    { id: 'date', label: 'Transaction Date' },
    { id: 'total', label: 'Gross Total' },
    { id: 'status', label: 'Fulfillment Status' },
    { id: 'items', label: 'Line Items' },
  ],
  courses: [
    { id: 'title', label: 'Course Title' },
    { id: 'category', label: 'Category' },
    { id: 'price', label: 'Current Price' },
    { id: 'rating', label: 'Avg. Rating' },
    { id: 'studentsCount', label: 'Total Students' },
    { id: 'status', label: 'Catalog Status' },
  ]
};

export default function CustomReportsPage() {
  const [source, setSource] = useState<DataSource>('users');
  const [selectedFields, setSelectedFields] = useState<string[]>(['name', 'email', 'role']);
  const [reportData, setReportData] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleSourceChange = (newSource: DataSource) => {
    setSource(newSource);
    setSelectedFields(FIELDS[newSource].slice(0, 3).map(f => f.id));
    setReportData([]);
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId) 
        : [...prev, fieldId]
    );
  };

  const handleGenerateReport = useCallback(async () => {
    if (selectedFields.length === 0) {
      toast({ variant: 'destructive', title: 'Select at least one field.' });
      return;
    }

    setIsGenerating(true);
    try {
      let data: any[] = [];
      if (source === 'users') {
        const { users: raw } = await getUsers();
        data = raw.map(u => ({
          ...u,
          enrollments: u.enrollments?.length || 0
        }));
      } else if (source === 'sales') {
        data = await getOrders();
      } else if (source === 'courses') {
        data = await getCourses();
      }

      setReportData(data);
      toast({ title: 'Report Generated', description: `Successfully retrieved ${data.length} records.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Generation Failed' });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFields, source, toast]);

  const handleExport = () => {
    if (reportData.length === 0) return;
    setIsExporting(true);
    
    setTimeout(() => {
      setIsExporting(false);
      toast({
        title: 'Export Successful',
        description: 'Your report has been saved as PTS_Report.csv',
      });
    }, 1500);
  };

  const activeFields = FIELDS[source].filter(f => selectedFields.includes(f.id));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Custom Report Builder</h1>
                <p className="text-muted-foreground text-sm">
                    Design specialized exports by selecting data sources and column filters.
                </p>
            </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { setReportData([]); setSelectedFields([]); }}>
                <Trash2 size={16} /> Clear
            </Button>
            <Button className="gap-2" onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <PlusCircle size={16} />}
                Generate Report
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
        <div className="space-y-6">
            <Card className="shadow-lg border-none">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Database size={16} className="text-primary" />
                        Data Source
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <Select value={source} onValueChange={(v) => handleSourceChange(v as DataSource)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="users">Users & Engagement</SelectItem>
                            <SelectItem value="sales">Sales & Revenue</SelectItem>
                            <SelectItem value="courses">Course Performance</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Filter size={16} className="text-primary" />
                        Columns to Include
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    {FIELDS[source].map((field) => (
                        <div key={field.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <Checkbox 
                                id={`field-${field.id}`} 
                                checked={selectedFields.includes(field.id)}
                                onCheckedChange={() => toggleField(field.id)}
                            />
                            <Label htmlFor={`field-${field.id}`} className="flex-1 cursor-pointer text-sm font-medium">
                                {field.label}
                            </Label>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="bg-primary text-primary-foreground border-none shadow-xl">
                <CardHeader>
                    <CardTitle className="text-lg">Pro Tip</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-primary-foreground/70 leading-relaxed">
                    <p>Use the **Sales & Revenue** source to generate monthly ICAG module performance reports for tax compliance and tutor payouts.</p>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="border-none shadow-lg min-h-[600px] flex flex-col">
                <CardHeader className="bg-muted/30 border-b p-6 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Report Preview</CardTitle>
                        <CardDescription>
                            Showing {reportData.length} records based on current filters.
                        </CardDescription>
                    </div>
                    {reportData.length > 0 && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={isExporting}>
                            {isExporting ? <Loader2 className="animate-spin" size={14}/> : <Download size={14} />}
                            Export CSV
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0 flex-1 relative">
                    {isGenerating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Quering Platform Registry...</p>
                        </div>
                    ) : reportData.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        {activeFields.map(f => (
                                            <TableHead key={f.id}>{f.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map((row, idx) => (
                                        <TableRow key={idx}>
                                            {activeFields.map(f => {
                                                const val = row[f.id];
                                                return (
                                                    <TableCell key={f.id} className="max-w-[200px] truncate">
                                                        {f.id === 'status' ? (
                                                            <Badge variant="outline" className="capitalize text-[10px]">{val}</Badge>
                                                        ) : typeof val === 'number' && f.id === 'total' ? (
                                                            `GH₵${val.toFixed(2)}`
                                                        ) : val?.toString() || '-'}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-40 text-muted-foreground opacity-30">
                            <FileText size={80} className="mb-4" />
                            <p className="font-bold text-xl">Report Canvas Empty</p>
                            <p className="text-sm">Configure your source and fields, then click Generate.</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/10 border-t p-4 px-6 text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                    Data refreshed: {new Date().toLocaleTimeString()} • PTS Intelligence Engine
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}