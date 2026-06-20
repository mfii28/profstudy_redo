'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { type User } from '@/lib/db';
import { resolveAvatarUrl } from '@/lib/media-url';
import { getUsers } from '@/lib/user-data';
import { useState, useEffect } from 'react';
import { Loader2, Star, Users, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EmptyState } from '@/components/dashboard/empty-state';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
}

const formatNumber = (num: number) => {
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
}

export default function AdminInstructorsPage() {
  const [instructors, setInstructors] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const { users } = await getUsers();
      setInstructors(users.filter((u) => u.role === 'tutor'));
      setIsLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">
            Instructor Management
          </h1>
          <p className="text-muted-foreground">
            Manage tutor applications, performance, and status.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Instructors</CardTitle>
          <CardDescription>
            A database of all registered tutors and their performance metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : instructors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Total Students</TableHead>
                  <TableHead>Lifetime Revenue</TableHead>
                  <TableHead>Average Rating</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructors.map((tutor) => (
                  <TableRow key={tutor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={resolveAvatarUrl(tutor.avatar)} alt={tutor.name} />
                          <AvatarFallback>
                            {tutor.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{tutor.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tutor.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatNumber(tutor.tutorDetails?.totalStudents || 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatCurrency(tutor.tutorDetails?.totalRevenue || 0)}</span>
                        </div>
                    </TableCell>
                     <TableCell>
                        <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{tutor.tutorDetails?.avgRating || 'N/A'}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {tutor.lastActive
                        ? formatDistanceToNow(new Date(tutor.lastActive), {
                            addSuffix: true,
                          })
                        : 'Never active'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState 
                icon={<Users className="h-16 w-16" />}
                title="No instructors found"
                description="When users are assigned the 'tutor' role, they will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
