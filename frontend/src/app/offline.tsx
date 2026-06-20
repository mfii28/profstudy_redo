export default function Offline() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="mb-4 font-headline text-4xl font-bold text-primary md:text-5xl">
          You're Offline
        </h1>
        <p className="mx-auto max-w-lg text-lg text-muted-foreground">
          It looks like you've lost your internet connection. Please check your connection and try again.
        </p>
      </div>
    </div>
  );
}
