
'use client';

import { motion } from 'framer-motion';
import { Award, BookOpen, BrainCircuit, GraduationCap } from 'lucide-react';

const roadmapSteps = [
    {
        icon: <BookOpen className="size-10 text-accent" />,
        title: 'Step 1: Enroll & Learn',
        description: 'Choose from our expert-led courses mapped directly to the official ICAG & CITG syllabus.',
    },
    {
        icon: <BrainCircuit className="size-10 text-accent" />,
        title: 'Step 2: Practice & Prepare',
        description: 'Utilize AI-generated mock exams, personalized quizzes, and targeted feedback to master key concepts.',
    },
    {
        icon: <Award className="size-10 text-accent" />,
        title: 'Step 3: Ace Your Exams',
        description: 'Approach your professional exams with confidence, backed by rigorous preparation and deep understanding.',
    },
    {
        icon: <GraduationCap className="size-10 text-accent" />,
        title: 'Step 4: Get Certified',
        description: 'Earn your professional certification and unlock new career opportunities and advancements.',
    }
];

export function StudentSuccessRoadmap() {
    return (
        <section className="bg-background section-pad-lg">
            <div className="page-container">
                <div className="text-center">
                    <h2 className="font-headline text-3xl font-bold text-primary md:text-4xl">Your Path to Certification</h2>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                        We transform Profs Training Solutions from a simple course platform into your dedicated partner for career success.
                    </p>
                </div>
                <div className="relative mt-12">
                    {/* Dashed line for desktop */}
                    <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2"></div>
                    
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                        {roadmapSteps.map((step, index) => (
                            <motion.div 
                                key={step.title}
                                className="relative flex flex-col items-center text-center p-6"
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.2 }}
                                viewport={{ once: true }}
                            >
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[calc(50%-1px)] md:static md:translate-x-0 md:translate-y-0 md:mb-6">
                                     <div className="flex items-center justify-center h-20 w-20 rounded-full bg-card shadow-md ring-4 ring-background">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                                            {step.icon}
                                        </div>
                                    </div>
                                </div>

                                {/* Vertical line for mobile */}
                                {index < roadmapSteps.length - 1 && (
                                    <div className="md:hidden absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-border -z-10 mt-10"></div>
                                )}
                                
                                <h3 className="mt-8 md:mt-0 font-headline text-xl font-bold">{step.title}</h3>
                                <p className="mt-2 text-muted-foreground">{step.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
