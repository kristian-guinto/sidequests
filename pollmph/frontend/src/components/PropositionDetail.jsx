import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ArrowLeft, Calendar, TrendingUp, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
  ReferenceLine
} from 'recharts';

export default function PropositionDetail() {
  const { id } = useParams();
  const [proposition, setProposition] = useState(null);
  const [sentiments, setSentiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    
    // Fetch proposition details
    const { data: propData, error: propError } = await supabase
      .from('propositions')
      .select('*')
      .eq('proposition_id', id)
      .single();

    if (propError) {
      console.error('Error fetching proposition:', propError);
      setLoading(false);
      return;
    }

    // Fetch sentiments - show last 30 days by default for efficiency
    const { data: sentData, error: sentError } = await supabase
      .from('sentiments')
      .select('*')
      .eq('proposition_id', id)
      .order('date_generated', { ascending: true })
      .limit(30);

    if (sentError) {
      console.error('Error fetching sentiments:', sentError);
      setLoading(false);
      return;
    }

    setProposition(propData);
    setSentiments(sentData || []);
    setLoading(false);
  }

  // Calculate 7-day moving average
  function calculateMovingAverage(data, key) {
    return data.map((item, index) => {
      if (index < 6) return null;
      const sum = data.slice(index - 6, index + 1).reduce((acc, curr) => acc + curr[key], 0);
      return sum / 7;
    });
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!proposition) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Proposition not found</div>
        <Link to="/">
          <Button className="mt-4">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const chartData = sentiments.map((s, index) => ({
    date: new Date(s.date_generated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    consensus: s.consensus_value * 100,
    attention: s.attention_value * 100,
    consensusMA: index >= 6 ? calculateMovingAverage(sentiments, 'consensus_value')[index] * 100 : null,
    attentionMA: index >= 6 ? calculateMovingAverage(sentiments, 'attention_value')[index] * 100 : null
  }));

  const consensusMA = chartData[chartData.length - 1]?.consensusMA;
  const attentionMA = chartData[chartData.length - 1]?.attentionMA;
  const isMajority = consensusMA >= 50;
  
  const visibleSentiments = [...sentiments].reverse().slice(0, visibleCount);
  const hasMore = visibleCount < sentiments.length;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const maConsensus = payload.find(p => p.dataKey === "consensusMA")?.value;
      const rawConsensus = payload.find(p => p.dataKey === "consensus")?.value;
      const maAttention = payload.find(p => p.dataKey === "attention")?.value;
      const isMajorityLocal = maConsensus >= 50;
      const lineColor = isMajorityLocal ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)';
      
      return (
        <div className="bg-card border shadow-xl rounded-md p-2 min-w-[160px]">
          <div className="text-[10px] font-semibold text-foreground mb-2 pb-1.5 border-b">{payload[0].payload.date}</div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: lineColor }}></div>
                <span className="text-[10px] font-medium text-foreground">Consensus</span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: lineColor }}>
                {maConsensus?.toFixed(1)}%
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-3 pl-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full opacity-40" style={{ backgroundColor: lineColor }}></div>
                <span className="text-[10px] text-muted-foreground">Raw</span>
              </div>
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {rawConsensus?.toFixed(1)}%
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-3 pt-1 mt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-0.5 rounded-full bg-muted-foreground opacity-50"></div>
                <span className="text-[10px] font-medium text-foreground">Attention</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {maAttention?.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Link to="/">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">{proposition.proposition_text}</h1>
        {proposition.search_queries && proposition.search_queries.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {proposition.search_queries.map((query, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {query}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Consensus (7d)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {consensusMA ? `${consensusMA.toFixed(1)}%` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {attentionMA ? `${attentionMA.toFixed(1)}%` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data Points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sentiments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Consensus Trend</CardTitle>
          <CardDescription>7-day moving average with attention levels</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 100]}
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} isAnimationActive={false} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} opacity={0.4} />
              <ReferenceLine y={100} stroke="hsl(var(--border))" strokeWidth={1} opacity={0.4} />
              <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" opacity={0.5} />
              <Line
                type="monotone"
                dataKey="consensus"
                stroke="transparent"
                strokeWidth={0}
                dot={{ r: 2, fill: isMajority ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)', stroke: 'none', opacity: 0.3 }}
                activeDot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="attention"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeOpacity={0.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 3, stroke: 'hsl(var(--card))', strokeWidth: 2, fill: 'hsl(var(--muted-foreground))' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="consensusMA"
                stroke={isMajority ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)'}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, stroke: 'hsl(var(--card))', strokeWidth: 2, fill: isMajority ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {sentiments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Daily Analysis Timeline</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Showing {visibleCount} of {sentiments.length} day{sentiments.length !== 1 ? 's' : ''}
          </p>
          
          <div className="space-y-4">
            {visibleSentiments.map((sentiment, index) => {
              const consensusValue = (sentiment.consensus_value * 100).toFixed(1);
              const attentionValue = (sentiment.attention_value * 100).toFixed(0);
              const dateStr = new Date(sentiment.date_generated).toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <Card key={sentiment.id || index} className="bg-muted/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {dateStr}
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-sm">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {consensusValue}%
                        </Badge>
                        <Badge variant="secondary" className="text-sm">
                          <Activity className="h-3 w-3 mr-1" />
                          {attentionValue}%
                        </Badge>
                        {sentiment.data_quality && (
                          <Badge variant="outline" className="text-xs">
                            Quality: {(sentiment.data_quality * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Consensus Rationale
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {sentiment.rationale_consensus || 'No rationale available'}
                        </p>
                      </div>
                      <div>
                        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Attention Rationale
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {sentiment.rationale_attention || 'No rationale available'}
                        </p>
                      </div>
                    </div>
                    
                    {sentiment.movement_analysis && (
                      <div className="pt-4 border-t">
                        <div className="text-sm font-semibold mb-2">Movement Analysis</div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {sentiment.movement_analysis}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button 
                variant="outline" 
                onClick={() => setVisibleCount(prev => prev + 5)}
              >
                Load More ({sentiments.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
