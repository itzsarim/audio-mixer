interface ProgressStepsProps {
  currentStep: number;
}

export default function ProgressSteps({ currentStep }: ProgressStepsProps) {
  const steps = [
    { number: 1, label: "Upload Audio" },
    { number: 2, label: "Create Mix" },
  ];

  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center justify-center space-x-2 sm:space-x-8 overflow-x-auto px-4">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-shrink-0">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.number
                    ? "bg-primary text-white"
                    : "bg-gray-300 text-gray-500"
                }`}
              >
                {step.number}
              </div>
              <span
                className={`ml-2 text-xs sm:text-sm font-medium whitespace-nowrap ${
                  currentStep >= step.number ? "text-primary" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 sm:w-16 h-0.5 ml-4 sm:ml-8 ${
                  currentStep > step.number ? "bg-primary" : "bg-gray-300"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
