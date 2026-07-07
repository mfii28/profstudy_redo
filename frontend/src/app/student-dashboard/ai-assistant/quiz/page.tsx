'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { type Course, type QuizQuestion } from "@/lib/db";
import { useState, useEffect } from "react";
import { getCoursesByIds } from "@/lib/course-data";
import { generateQuizFromText } from "@/app/actions/quiz-generation";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useStudentProfile } from "@/hooks/use-student-profile";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiQuizGeneratorPage() {
    const { user: currentUser, profile, isLoading: isUserLoading } = useStudentProfile();
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState('5');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Expert'>('Medium');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<{ quiz: QuizQuestion[] } | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [weakAreaAnalysis, setWeakAreaAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
            if (currentUser && profile) {
        try {
          setIsCoursesLoading(true);
                    const enrollmentIds = (profile.enrollments || []).map((enrollment) => enrollment.courseId);
                    const courses = await getCoursesByIds(enrollmentIds);
          setEnrolledCourses(courses);
        } catch (e) {
          console.error(e);
        } finally {
          setIsCoursesLoading(false);
        }
            } else if (!isUserLoading) {
                setIsCoursesLoading(false);
      }
    };
        void fetchData();
    }, [currentUser, profile, isUserLoading]);

  const handleGenerateQuiz = async () => {
    if (!selectedCourseId) {
        toast({ variant: "destructive", title: "Please select a course." });
        return;
    }
    if (!currentUser || !profile) return;
    
    setIsLoading(true);
    setGeneratedQuiz(null);
    setSubmitted(false);
    setUserAnswers({});

    try {
        const course = enrolledCourses.find(c => c.id === selectedCourseId);
        if (!course) throw new Error("Course not found");

        const lessonContent = course.sections
            .flatMap(section => section.lessons.map(lesson => `Lesson: ${lesson.title}\nContent: ${lesson.description || 'N/A'}`))
            .join('\n\n---\n\n');
        
        if (!lessonContent) {
             toast({
                variant: "destructive",
                title: "No content found for this course.",
                description: "Cannot generate a quiz for a course with no lesson descriptions."
            });
            setIsLoading(false);
            return;
        }

        const result = await generateQuizFromText(
            lessonContent,
            topic || course.title,
            parseInt(numQuestions) || 5
        );
        if (result.error) {
            throw new Error(result.error);
        }
        if (result.questions) {
            setGeneratedQuiz({ quiz: result.questions });
        }
    } catch (error) {
        console.error("Failed to generate quiz", error);
        toast({
            variant: "destructive",
            title: "AI Error",
            description: "Failed to generate the quiz. Please try again."
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
    setUserAnswers(prev => ({...prev, [questionIndex]: answerIndex}));
  }

  const handleSubmitQuiz = () => {
    setSubmitted(true);
  }



  const getScore = () => {
    if (!generatedQuiz) return 0;
    let correct = 0;
    generatedQuiz.quiz.forEach((q, index) => {
        if (userAnswers[index] === q.correctAnswerIndex) {
            correct++;
        }
    });
    return Math.round((correct / generatedQuiz.quiz.length) * 100);
  }

  if (isUserLoading || !currentUser || !profile) {
      return (
          <div className="space-y-8">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-96 w-full" />
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
            <h1 className="text-3xl font-bold mb-2 font-headline">AI Quiz Master</h1>
            <p className="text-muted-foreground">
            Creates unique tests based on your weak areas to ensure you're exam-ready.
            </p>
        </div>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Dynamic Testing Module</CardTitle>
            <CardDescription>Configure your practice quiz below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid gap-2">
                <Label htmlFor="course">Course / Subject</Label>
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId} disabled={isCoursesLoading}>
                    <SelectTrigger id="course">
                        <SelectValue placeholder={isCoursesLoading ? "Loading courses..." : "Select a subject"} />
                    </SelectTrigger>
                    <SelectContent>
                        {enrolledCourses.map(course => (
                            <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="topic">Focus Topic (Optional)</Label>
                <Input id="topic" placeholder="e.g., IFRS 9, Company Meetings" value={topic} onChange={e => setTopic(e.target.value)} />
             </div>
             <div className="grid gap-2">
                <Label htmlFor="questions">Number of Questions</Label>
                <Input id="questions" type="number" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} />
            </div>
             <div className="grid gap-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select value={difficulty} onValueChange={(val) => setDifficulty(val as 'Easy' | 'Medium' | 'Hard' | 'Expert')}>
                    <SelectTrigger id="difficulty">
                        <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Easy">Easy — Basic recall & comprehension</SelectItem>
                        <SelectItem value="Medium">Medium — Application & analysis</SelectItem>
                        <SelectItem value="Hard">Hard — Complex scenarios & synthesis</SelectItem>
                        <SelectItem value="Expert">Expert — Professional-level challenges</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
        <CardFooter>
            <Button size="lg" onClick={handleGenerateQuiz} disabled={isLoading || isCoursesLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-4 w-4" />}
                Generate Quiz
            </Button>
        </CardFooter>
      </Card>

      {generatedQuiz && (
        <Card>
            <CardHeader>
                <CardTitle>Quiz: {topic || enrolledCourses.find(c => c.id === selectedCourseId)?.title}</CardTitle>
                <CardDescription>Answer the questions below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {generatedQuiz.quiz.map((q, qIndex) => (
                    <div key={qIndex} className="space-y-4">
                        <p className="font-semibold">{qIndex + 1}. {q.questionText}</p>
                        <RadioGroup onValueChange={(val) => handleAnswerChange(qIndex, parseInt(val))} disabled={submitted}>
                            {q.options.map((option, oIndex) => {
                                const isCorrect = oIndex === q.correctAnswerIndex;
                                const isSelected = userAnswers[qIndex] === oIndex;
                                return (
                                    <div key={oIndex} className={cn(
                                        "flex items-center space-x-2 p-3 rounded-md border",
                                        submitted && isCorrect && "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700",
                                        submitted && isSelected && !isCorrect && "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700"
                                    )}>
                                        <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}o${oIndex}`} />
                                        <Label htmlFor={`q${qIndex}o${oIndex}`}>{option}</Label>
                                    </div>
                                )
                            })}
                        </RadioGroup>
                        {submitted && <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md"><strong>Explanation:</strong> {q.explanation}</p>}
                    </div>
                ))}
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                {!submitted ? (
                    <Button onClick={handleSubmitQuiz}>Submit Answers</Button>
                ) : (
                    <>
                        <div className="text-xl font-bold">Your Score: {getScore()}%</div>

                    </>
                )}
            </CardFooter>
        </Card>
      )}

    </div>
  );
}
