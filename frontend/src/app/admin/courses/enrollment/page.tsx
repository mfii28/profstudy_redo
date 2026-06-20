
'use client';

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Loader2, Search, ShieldCheck, AlertCircle, CheckCircle2, Users, DollarSign, Filter, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCourses } from "@/lib/course-data";
import { type Course, type GlobalSettings } from "@/lib/db";
import { useUser } from "@/firebase";
import { logAdminAction } from "@/lib/audit-data";
import { bulkEnrollUsersInCourseByAdmin, enrollUserInCourseByAdmin, findUserForManualEnrollment, searchUsersForManualEnrollment, recordManualPayment } from "@/app/actions/admin-enrollment";
import { defaultGlobalSettings, getGlobalSettings } from "@/lib/platform-settings-data";

function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19.05 4.94A9.94 9.94 0 0 0 12.03 2C6.52 2 2.03 6.48 2.03 12c0 1.77.46 3.5 1.34 5.03L2 22l5.1-1.34A9.94 9.94 0 0 0 12.03 22c5.51 0 10-4.48 10-10 0-2.67-1.04-5.18-2.98-7.06Zm-7.02 15.37c-1.5 0-2.97-.4-4.26-1.15l-.3-.18-3.03.79.81-2.95-.2-.31A8.2 8.2 0 0 1 3.8 12c0-4.54 3.69-8.23 8.23-8.23 2.2 0 4.27.86 5.82 2.41A8.18 8.18 0 0 1 20.26 12c0 4.54-3.69 8.23-8.23 8.23Zm4.51-6.17c-.25-.13-1.47-.72-1.7-.81-.23-.08-.4-.12-.57.13-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.13-1.04-.38-1.98-1.2-.73-.65-1.23-1.44-1.37-1.69-.15-.25-.02-.39.11-.52.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.38-.78-1.89-.21-.5-.43-.43-.57-.43h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.43 1.02 2.6.13.17 1.77 2.7 4.29 3.78.6.26 1.08.42 1.45.54.61.19 1.17.16 1.61.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.07-.1-.23-.17-.48-.29Z" />
    </svg>
  );
}

/**
 * @fileOverview Manual Enrollment workflow with mandatory student identity verification.
 * Hard-gates the authorization to prevent data corruption.
 * Enhanced with bulk student selection, manual payment tracking, and improved UX.
 */

export default function AdminManualEnrollmentPage() {
  type VerifiedUser = { id: string; name: string; email: string };
  const { user: adminUser } = useUser();
  const [userEmail, setUserEmail] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCourses, setIsFetchingCourses] = useState(true);
  const [foundUser, setFoundUser] = useState<VerifiedUser | null>(null);
  const [searchResults, setSearchResults] = useState<VerifiedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<VerifiedUser[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [allStudents, setAllStudents] = useState<VerifiedUser[]>([]);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
  const [studentFilterText, setStudentFilterText] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  
  // Manual payment state
  const [manualPaymentMode, setManualPaymentMode] = useState(false);
  const [manualPaymentAmount, setManualPaymentAmount] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('cash');
  const [manualPaymentNote, setManualPaymentNote] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const allCourses = await getCourses();
        setCourses(allCourses.filter(c => (c.status || '').toLowerCase() === 'published'));
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setIsFetchingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    getGlobalSettings().then(setSettings).catch(() => setSettings(defaultGlobalSettings));
  }, []);

  const whatsappPhone = settings.supportPhone.replace(/[^\d]/g, '');
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent('Hello Admin, I need help with manual enrollment.')}`
    : '';

  // Load all students when dropdown is opened
  const handleOpenStudentDropdown = async () => {
    if (!adminUser) return;
    if (hasLoadedStudents) {
      setShowStudentDropdown(true);
      return;
    }
    
    setIsFetchingStudents(true);
    try {
      const idToken = await adminUser!.getIdToken(true);
      const result = await searchUsersForManualEnrollment(idToken, '', 500);
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Failed to load students', description: result.error });
        return;
      }
      setAllStudents(result.users);
      setHasLoadedStudents(true);
      setShowStudentDropdown(true);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error loading students' });
    } finally {
      setIsFetchingStudents(false);
    }
  };

  // Filter students based on search text
  const filteredStudents = allStudents.filter(student => 
    student.name.toLowerCase().includes(studentFilterText.toLowerCase()) ||
    student.email.toLowerCase().includes(studentFilterText.toLowerCase())
  );

  const handleVerifyUser = async () => {
    const normalizedEmail = userEmail.trim().toLowerCase();
    if (!normalizedEmail || !adminUser) return;
    setIsVerifying(true);
    setFoundUser(null);
    try {
      const idToken = await adminUser.getIdToken(true);
      const result = await findUserForManualEnrollment(idToken, normalizedEmail);
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'User Not Found', description: result.error });
        return;
      }
      setUserEmail(normalizedEmail);
      setFoundUser(result.user);
      toast({ title: 'Student Identity Verified' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Verification Error', description: 'Unable to query user records right now.' });
    } finally {
        setIsVerifying(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!adminUser || !userEmail.trim()) return;
    setIsSearching(true);
    try {
      const idToken = await adminUser.getIdToken(true);
      const result = await searchUsersForManualEnrollment(idToken, userEmail.trim(), 20);
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Search failed', description: result.error });
        return;
      }
      setSearchResults(result.users);
      if (!result.users.length) {
        toast({ title: 'No matches found', description: 'Try a different name or email.' });
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnroll = async () => {
    if (!foundUser || !selectedCourseId || !adminUser) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Verify student identity first." });
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await adminUser.getIdToken(true);
      const result = await enrollUserInCourseByAdmin(idToken, foundUser.id, selectedCourseId);
      if (!('error' in result)) {
        const courseName = courses.find(c => c.id === selectedCourseId)?.title || "the course";
        
        // SECURITY: Audit the manual override
        await logAdminAction({
            actorId: adminUser.uid,
            actorName: adminUser.displayName || adminUser.email || 'Administrator',
            action: 'MANUAL_ENROLLMENT',
            targetId: foundUser.id,
            targetType: 'user',
            severity: 'warn',
            details: `Manually granted ${foundUser.email} access to "${courseName}".`
        });

        toast({ title: "Enrollment Finalized" });
        setUserEmail('');
        setFoundUser(null);
        setSelectedCourseId('');
      } else {
        toast({ variant: "destructive", title: "Failed", description: result.error });
      }
    } catch (error) {
       toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkEnroll = async () => {
    if (!adminUser || !selectedCourseId || selectedUsers.length === 0) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Select at least one user and a course." });
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await adminUser.getIdToken(true);
      const result = await bulkEnrollUsersInCourseByAdmin(idToken, selectedUsers.map((u) => u.id), selectedCourseId);
      if ('error' in result) {
        toast({ variant: "destructive", title: "Bulk enrollment failed", description: result.error });
        return;
      }
      
      // Log audit trail
      const courseName = courses.find(c => c.id === selectedCourseId)?.title || "a course";
      const studentEmails = selectedUsers.map(u => u.email).join(', ');
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'BULK_MANUAL_ENROLLMENT',
        targetId: selectedCourseId,
        targetType: 'course',
        severity: 'warn',
        details: `Manually enrolled ${selectedUsers.length} students in "${courseName}": ${studentEmails}`
      });

      toast({
        title: "Bulk enrollment completed",
        description: `${result.successCount} succeeded, ${result.failedCount} failed.`,
      });
      setSelectedUsers([]);
      setSearchResults([]);
      setUserEmail('');
      setShowStudentDropdown(false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStudentSelection = (user: VerifiedUser) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleRecordManualPayment = async () => {
    if (!selectedUsers.length || !selectedCourseId || !manualPaymentAmount || !adminUser) {
      toast({ variant: "destructive", title: "Missing information", description: "Select students, course, and enter amount." });
      return;
    }

    setIsRecordingPayment(true);
    try {
      const idToken = await adminUser.getIdToken(true);
      const amount = parseFloat(manualPaymentAmount);
      
      const result = await recordManualPayment(
        idToken,
        selectedUsers.map(u => u.id),
        selectedCourseId,
        amount,
        manualPaymentMethod,
        manualPaymentNote
      );

      if ('error' in result) {
        toast({ variant: "destructive", title: "Payment recording failed", description: result.error });
        return;
      }

      // Log audit trail
      const courseName = courses.find(c => c.id === selectedCourseId)?.title || "a course";
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'MANUAL_PAYMENT_RECORDED',
        targetId: selectedCourseId,
        targetType: 'course',
        severity: 'info',
        details: `Recorded ${manualPaymentMethod} payment of ${amount} for ${selectedUsers.length} students in "${courseName}". Note: ${manualPaymentNote}`
      });

      toast({
        title: "Payment recorded",
        description: `Recorded payment for ${selectedUsers.length} student(s).`,
      });

      // Reset payment form
      setManualPaymentAmount('');
      setManualPaymentMethod('cash');
      setManualPaymentNote('');
      setManualPaymentMode(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error recording payment" });
    } finally {
      setIsRecordingPayment(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10"><UserPlus className="h-8 w-8 text-primary" /></div>
        <div>
          <h1 className="text-3xl font-bold mb-1 font-headline">Manual Enrollment & Payments</h1>
          <p className="text-muted-foreground text-sm">Enroll students in bulk or record manual payments for cash transactions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Main Workflow */}
        <div className="space-y-6">
          {/* Step 1: Select Course */}
          <Card className="shadow-lg border-none overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Step 1: Select Course</CardTitle>
              <CardDescription>Choose which course to work with</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Label className="mb-3 block">Course</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Choose a course..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Step 2: Select Students */}
          {selectedCourseId && (
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Step 2: Select Students</CardTitle>
                <CardDescription>Choose one or multiple students from the list</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* Search in Dropdown */}
                <div className="space-y-2">
                  <Label>Find Students</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name or email..." 
                        className="pl-9 h-11"
                        value={studentFilterText}
                        onChange={(e) => setStudentFilterText(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleOpenStudentDropdown}
                      disabled={isFetchingStudents}
                      className="h-11"
                    >
                      {isFetchingStudents ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                      Browse
                    </Button>
                  </div>
                </div>

                {/* Student Dropdown List */}
                {showStudentDropdown && (
                  <div className="rounded-xl border bg-white p-3 space-y-2 max-h-72 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {isFetchingStudents ? 'Loading students...' : hasLoadedStudents ? 'No students found' : 'Browse students to begin'}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {filteredStudents.map((student) => {
                          const isSelected = selectedUsers.some((u) => u.id === student.id);
                          return (
                            <label key={student.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleStudentSelection(student)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{student.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Students Summary */}
                {selectedUsers.length > 0 && (
                  <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-green-900">✓ Selected Students ({selectedUsers.length})</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between text-xs bg-white rounded p-2">
                          <span className="text-green-900">{user.name}</span>
                          <button
                            onClick={() => toggleStudentSelection(user)}
                            className="text-green-600 hover:text-green-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Action Buttons */}
          {selectedUsers.length > 0 && selectedCourseId && (
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">Step 3: Perform Action</CardTitle>
                <CardDescription>Choose what to do with these students</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <Button 
                  onClick={handleBulkEnroll}
                  disabled={isLoading}
                  size="lg"
                  className="w-full gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Enroll {selectedUsers.length} Student{selectedUsers.length !== 1 ? 's' : ''} in Course
                </Button>

                <Button 
                  onClick={() => setManualPaymentMode(!manualPaymentMode)}
                  variant="outline"
                  size="lg"
                  className="w-full gap-2"
                >
                  {manualPaymentMode ? "✕ Cancel Payment" : (
                    <>
                      <DollarSign className="h-4 w-4" />
                      Record Manual Payment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Manual Payment Form */}
          {manualPaymentMode && selectedUsers.length > 0 && selectedCourseId && (
            <Card className="shadow-lg border-2 border-blue-200 overflow-hidden bg-blue-50/30">
              <CardHeader className="border-b bg-blue-100/30">
                <CardTitle className="flex items-center gap-2 text-blue-900"><DollarSign className="h-5 w-5" /> Record Cash Payment</CardTitle>
                <CardDescription>Record manual payment from {selectedUsers.length} student{selectedUsers.length !== 1 ? 's' : ''}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Payment Amount (per student)</Label>
                  <Input 
                    type="number"
                    placeholder="0.00"
                    value={manualPaymentAmount}
                    onChange={(e) => setManualPaymentAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total: {selectedUsers.length} × {manualPaymentAmount || '0'} = {selectedUsers.length * (parseFloat(manualPaymentAmount) || 0)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={manualPaymentMethod} onValueChange={setManualPaymentMethod}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="mobile-money">Mobile Money</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Transaction Note</Label>
                  <Input 
                    placeholder="e.g., Payment received from John, Transaction ref: #123456"
                    value={manualPaymentNote}
                    onChange={(e) => setManualPaymentNote(e.target.value)}
                    className="h-11"
                  />
                </div>

                <Button 
                  onClick={handleRecordManualPayment}
                  disabled={isRecordingPayment || !manualPaymentAmount}
                  size="lg"
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {isRecordingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                  Record Payment
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: Governance & Info */}
        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-accent" /> Governance Rules</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3 text-slate-300">
              <p>Manual enrollment overrides the transactional ledger. Every override is recorded with your unique Admin ID in the immutable Security Audit Log.</p>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10 italic">
                "Use this tool only for scholarships, corporate bulk seats, or resolving payment gateway disputes."
              </div>
              {whatsappHref ? (
                <Button asChild className="w-full justify-start gap-2 bg-[#25D366] text-white hover:bg-[#1faa55]">
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="h-4 w-4" />
                    Contact Admin on WhatsApp
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-amber-900"><DollarSign className="h-4 w-4" /> Payment Tracking</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-amber-900">
              <p>Cash payments recorded here are:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Logged in audit trail</li>
                <li>Visible in student receipts</li>
                <li>Included in financial reports</li>
                <li>Associated with enrollment</li>
              </ul>
            </CardContent>
          </Card>

          {selectedUsers.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="text-sm text-blue-900">Current Selection</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div>
                  <p className="text-blue-600 font-medium">Students: {selectedUsers.length}</p>
                  <p className="text-muted-foreground">Course: {courses.find(c => c.id === selectedCourseId)?.title}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
