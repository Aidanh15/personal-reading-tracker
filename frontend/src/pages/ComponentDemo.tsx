import { useState } from 'react';
import { Button, Input, Modal, ProgressBar, LoadingSpinner, Grid } from '../components/UI';

function ComponentDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.length < 3) {
      setInputError('Must be at least 3 characters');
    } else {
      setInputError('');
    }
  };

  const handleLoadingDemo = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">UI Components Demo</h1>
        <p className="text-gray-600 mb-8">
          This page demonstrates all the UI components implemented in Task 8.
        </p>

        {/* Buttons */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Buttons</h2>
          <div className="flex flex-wrap gap-4 mb-4">
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="danger">Danger Button</Button>
          </div>
          <div className="flex flex-wrap gap-4 mb-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button disabled>Disabled</Button>
            <Button loading={isLoading} onClick={handleLoadingDemo}>
              {isLoading ? 'Loading...' : 'Click for Loading Demo'}
            </Button>
          </div>
        </section>

        {/* Inputs */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Input Fields</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Basic Input"
              placeholder="Enter some text"
              value={inputValue}
              onChange={handleInputChange}
              error={inputError}
            />
            <Input
              label="Email Input"
              type="email"
              placeholder="your@email.com"
              helperText="We'll never share your email"
            />
            <Input
              label="Disabled Input"
              placeholder="This is disabled"
              disabled
            />
            <Input
              label="Required Input"
              placeholder="This field is required"
              required
            />
          </div>
        </section>

        {/* Progress Bars */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Progress Bars</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Basic Progress (25%)</p>
              <ProgressBar progress={25} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">With Percentage (60%)</p>
              <ProgressBar progress={60} showPercentage />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Complete (100%)</p>
              <ProgressBar progress={100} showPercentage />
            </div>
          </div>
        </section>

        {/* Loading Spinners */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Loading Spinners</h2>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <LoadingSpinner size="sm" />
              <p className="text-sm text-gray-600 mt-2">Small</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="md" />
              <p className="text-sm text-gray-600 mt-2">Medium</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-gray-600 mt-2">Large</p>
            </div>
          </div>
        </section>

        {/* Modal */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Modal</h2>
          <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
          
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Demo Modal"
            size="md"
          >
            <div className="space-y-4">
              <p>This is a demo modal with various content.</p>
              <Input
                label="Modal Input"
                placeholder="You can interact with inputs in modals"
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsModalOpen(false)}>
                  Save
                </Button>
              </div>
            </div>
          </Modal>
        </section>

        {/* Grid Layout */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Grid Layout</h2>
          
          <div className="mb-6">
            <h3 className="text-md font-medium mb-2">3 Column Grid (Default)</h3>
            <Grid cols={3} gap="md">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="card !p-4 text-center">
                  <p className="text-gray-600">Item {i + 1}</p>
                </div>
              ))}
            </Grid>
          </div>

          <div className="mb-6">
            <h3 className="text-md font-medium mb-2">4 Column Grid</h3>
            <Grid cols={4} gap="sm">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="card !p-3 text-center">
                  <p className="text-sm text-gray-600">Item {i + 1}</p>
                </div>
              ))}
            </Grid>
          </div>

          <div>
            <h3 className="text-md font-medium mb-2">2 Column Grid with Large Gap</h3>
            <Grid cols={2} gap="lg">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="card !p-6 text-center">
                  <p className="text-gray-600">Large Item {i + 1}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    This demonstrates the large gap spacing between grid items.
                  </p>
                </div>
              ))}
            </Grid>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ComponentDemo;