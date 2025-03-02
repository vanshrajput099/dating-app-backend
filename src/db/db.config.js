import neo4j from "neo4j-driver";
import cron from "node-cron";

export const driver = neo4j.driver(
  process.env.NEO4J_URL,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

const connectDatabase = async () => {
  try {
    await driver.getServerInfo();
    cron.schedule('0 * * * *', async () => {
      try {
        const result = await session.run(`
          MATCH (t:Token)
          WHERE t.createdAt < (timestamp() - 86400000)
          DELETE t
        `);
        console.log('Expired tokens deleted:', result.summary.counters.updates().nodesDeleted);
      } catch (error) {
        console.error('Error deleting expired tokens:', error.message);
      }
    });
  } catch (error) {
    throw error;
  }
};

export default connectDatabase;
