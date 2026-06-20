'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, BookOpen, DollarSign, Shield, Loader2, Ticket, Settings, ArrowRight, Zap, Library, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { getAdminDashboardStats } from '@/app/actions/admin-dashboard';
import { disableTempSuperadminSignup } from '@/app/actions/superadmin-temp-signup';
import { useToast } from '@/hooks/use-toast';
import { isQuotaError, toUserFacingMessage } from '@/lib/service-errors';
import { reportQuotaError } from '@/lib/feedback/quota-state';

function StatCard({ icon, title, value, description, isLoading, accent }: { icon: React.ReactNode, title: string, value: string, description?: string, isLoading: boolean, accent?: string }) {
    return (
        <Card className={accent ? `border-l-4 ${accent}` : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">{title}</CardTitle>
            <div className="text-muted-foreground shrink-0">{icon}</div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 md:p-6 md:pt-0">
            {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-3/4" />
            ) : (
                <>
                    <div className="text-lg sm:text-2xl font-bold leading-tight">{value}</div>
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </>
            )}
            </CardContent>
        </Card>
    );
}

function QuickActionCard({ icon, title, description, href, badge }: { icon: React.ReactNode, title: string, description: string, href: string, badge?: string }) {
    return (
        <Link href={href} className="block transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
            <Card className="h-full border-none shadow-md bg-card hover:bg-accent/5 transition-colors duration-200">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-primary/5 text-primary">
                            {icon}
                        </div>
                        {badge && (
                            <span className="text-[10px] font-bold bg-accent/10 text-accent-foreground px-2 py-1 rounded-full uppercase tracking-widest">
                                {badge}
                            </span>
                        )}
                    </div>
                    <h3 className="font-bold text-lg mb-1">{title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>
                    <div className="flex items-center text-xs font-bold text-primary group">
                        Enter Module <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

export default function AdminDashboardPage() {
    const { user: adminUser, isLoading: authLoading } = useUser();
    const { toast } = useToast();
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalCourses: 0,
        totalRevenue: 0,
        pendingApprovals: 0,
        totalBooks: 0,
        totalReviews: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isDisablingTempSignup, setIsDisablingTempSignup] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!adminUser) {
            setIsLoading(false);
            return;
        }

        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const idToken = await adminUser.getIdToken(true);
                const result = await getAdminDashboardStats(idToken);
                if (result.error) {
                    throw new Error(result.error);
                }

                setStats({
                    totalUsers: result.totalUsers,
                    totalCourses: result.totalCourses,
                    totalRevenue: result.totalRevenue,
                    pendingApprovals: result.pendingApprovals,
                    totalBooks: result.totalBooks,
                    totalReviews: result.totalReviews,
                });
            } catch (error) {
                if (isQuotaError(error)) {
                    reportQuotaError(error);
                }
                toast({
                    variant: 'destructive',
                    title: 'Dashboard metrics unavailable',
                    description: toUserFacingMessage(error, { feature: 'Admin dashboard' }),
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, [authLoading, adminUser, toast]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
    }

    const handleDisableTempSignup = async () => {
        if (!adminUser) return;
        setIsDisablingTempSignup(true);
        try {
            const idToken = await adminUser.getIdToken(true);
            const result = await disableTempSuperadminSignup(idToken);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Unable to disable temp signup', description: result.error });
                return;
            }
            toast({ title: 'Temporary superadmin signup disabled' });
        } finally {
            setIsDisablingTempSignup(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-1 font-headline">Super Admin Command Center</h1>
                    <p className="text-muted-foreground text-sm">
                        Platform-wide performance and operational controls.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/admin/settings/general">
                            <Settings className="mr-2 h-4 w-4" /> Global Settings
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/admin/marketing/announcements">
                            <Zap className="mr-2 h-4 w-4" /> Broadcast
                        </Link>
                    </Button>
                </div>
            </div>

             <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <StatCard
                    isLoading={isLoading}
                    icon={<Users size={16} />}
                    title="Total Users"
                    value={stats.totalUsers.toLocaleString()}
                    description="Registered accounts"
                    accent="border-blue-500"
                />
                <StatCard
                    isLoading={isLoading}
                    icon={<BookOpen size={16} />}
                    title="Courses"
                    value={stats.totalCourses.toLocaleString()}
                    description="Catalog size"
                    accent="border-violet-500"
                />
                <StatCard
                    isLoading={isLoading}
                    icon={<Library size={16} />}
                    title="Books"
                    value={stats.totalBooks.toLocaleString()}
                    description="Store inventory"
                    accent="border-orange-500"
                />
                <StatCard
                    isLoading={isLoading}
                    icon={<Star size={16} />}
                    title="Reviews"
                    value={stats.totalReviews.toLocaleString()}
                    description="Course reviews"
                    accent="border-amber-500"
                />
                <StatCard
                    isLoading={isLoading}
                    icon={<DollarSign size={16} />}
                    title="Revenue"
                    value={formatCurrency(stats.totalRevenue)}
                    description="Gross transactions"
                    accent="border-green-500"
                />
                <StatCard
                    isLoading={isLoading}
                    icon={<Shield size={16} />}
                    title="Pending"
                    value={stats.pendingApprovals.toString()}
                    description="Courses awaiting review"
                    accent="border-red-500"
                />
            </div>
            
            <div>
                <h3 className="text-xl font-bold mb-6 font-headline">Module Access</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    <QuickActionCard 
                        icon={<Users className="h-6 w-6" />}
                        title="User Registry"
                        description="Manage student academic data, AI credits, and roles."
                        href="/admin/users"
                    />
                    <QuickActionCard 
                        icon={<BookOpen className="h-6 w-6" />}
                        title="Course Queue"
                        description="Approve or reject content from professional instructors."
                        href="/admin/courses"
                        badge={stats.pendingApprovals > 0 ? `${stats.pendingApprovals} New` : undefined}
                    />
                    <QuickActionCard 
                        icon={<DollarSign className="h-6 w-6" />}
                        title="Financials"
                        description="Audit transaction logs and authorize instructor payouts."
                        href="/admin/finance"
                    />
                    <QuickActionCard 
                        icon={<Ticket className="h-6 w-6" />}
                        title="Support Hub"
                        description="Resolve student issues and technical support tickets."
                        href="/admin/support"
                    />
                </div>
            </div>

            <Card className="bg-primary text-primary-foreground border-none overflow-hidden relative">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 translate-x-1/2" />
                <CardHeader>
                    <CardTitle className="text-xl">Platform Governance</CardTitle>
                    <CardDescription className="text-primary-foreground/70">
                        Adjust global settings, manage security protocols, and monitor system health.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="secondary" size="sm" asChild>
                            <Link href="/admin/settings/general">General Settings</Link>
                        </Button>
                        <Button variant="outline" className="bg-white/10 hover:bg-white/20 border-white/20" size="sm" asChild>
                            <Link href="/admin/security">Security Center</Link>
                        </Button>
                        <Button variant="outline" className="bg-white/10 hover:bg-white/20 border-white/20" size="sm" asChild>
                            <Link href="/admin/system-health">System Health</Link>
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-white/10 hover:bg-white/20 border-white/20"
                            size="sm"
                            onClick={() => void handleDisableTempSignup()}
                            disabled={isDisablingTempSignup}
                        >
                            {isDisablingTempSignup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Disable Temp Superadmin Signup
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
