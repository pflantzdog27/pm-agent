import dotenv from 'dotenv';
import { getExecutor } from './src/services/codeExecutorSimple';

// Load environment variables
dotenv.config();

const TEST_PROJECT_ID = 'f46354d7-887a-402b-bfb7-eae8f9467cb5';

async function runTests() {
  console.log('═══════════════════════════════════════════');
  console.log('Testing Code Execution Infrastructure');
  console.log('═══════════════════════════════════════════\n');

  const executor = getExecutor();

  // Test 1: Simple console.log
  console.log('=== Test 1: Basic Execution ===');
  try {
    const result1 = await executor.execute(
      `console.log('Hello from sandbox!');`,
      { projectId: TEST_PROJECT_ID }
    );
    console.log('✓ Success:', result1.success);
    console.log('Output:', result1.output);
    console.log('Execution time:', result1.executionTime + 'ms');
    console.log('');
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // Test 2: Using projectId variable
  console.log('=== Test 2: Access Context Variables ===');
  try {
    const result2 = await executor.execute(
      `console.log('Project ID:', projectId);`,
      { projectId: TEST_PROJECT_ID }
    );
    console.log('✓ Success:', result2.success);
    console.log('Output:', result2.output);
    console.log('');
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // Test 3: Using stories API
  console.log('=== Test 3: Stories API ===');
  try {
    const result3 = await executor.execute(
      `
      const allStories = await stories.findAll(projectId);
      console.log(\`Found \${allStories.length} stories\`);
      for (const story of allStories.slice(0, 3)) {
        console.log(\`- \${story.story_key}: \${story.title} (\${story.status})\`);
      }
      `,
      { projectId: TEST_PROJECT_ID }
    );
    console.log('✓ Success:', result3.success);
    console.log('Output:', result3.output);
    console.log('');
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // Test 4: Find story by key
  console.log('=== Test 4: Find Story by Key ===');
  try {
    const result4 = await executor.execute(
      `
      const story = await stories.findByKey('STORY-001', projectId);
      if (story) {
        console.log(\`Found: \${story.story_key} - \${story.title}\`);
        console.log(\`Status: \${story.status}, Points: \${story.story_points}\`);
      } else {
        console.log('Story STORY-001 not found');
      }
      `,
      { projectId: TEST_PROJECT_ID }
    );
    console.log('✓ Success:', result4.success);
    console.log('Output:', result4.output);
    console.log('');
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // Test 5: Complex logic
  console.log('=== Test 5: Complex Logic ===');
  try {
    const result5 = await executor.execute(
      `
      const allStories = await stories.findAll(projectId);

      // Count stories by status
      const statusCounts = {};
      for (const story of allStories) {
        statusCounts[story.status] = (statusCounts[story.status] || 0) + 1;
      }

      console.log('Story Status Summary:');
      for (const [status, count] of Object.entries(statusCounts)) {
        console.log(\`  \${status}: \${count}\`);
      }

      // Calculate total points
      const totalPoints = allStories.reduce((sum, s) => sum + (s.story_points || 0), 0);
      console.log(\`Total Story Points: \${totalPoints}\`);
      `,
      { projectId: TEST_PROJECT_ID }
    );
    console.log('✓ Success:', result5.success);
    console.log('Output:', result5.output);
    console.log('');
  } catch (error) {
    console.error('✗ Error:', error);
  }

  // Test 6: Error handling
  console.log('=== Test 6: Error Handling ===');
  try {
    const result6 = await executor.execute(
      `throw new Error('Test error from sandbox');`,
      { projectId: TEST_PROJECT_ID }
    );
    console.log('✓ Caught error successfully');
    console.log('Success:', result6.success);
    console.log('Error:', result6.error);
    console.log('');
  } catch (error) {
    console.error('✗ Unexpected error:', error);
  }

  console.log('═══════════════════════════════════════════');
  console.log('All Tests Complete!');
  console.log('═══════════════════════════════════════════');

  // Clean up
  executor.dispose();
}

// Run tests
runTests().catch(console.error);
