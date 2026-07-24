"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DikshaAutomationPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setMessage("Please enter both username and password.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/diksha/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to start automation");
      }

      setStatus("success");
      setMessage(data.message || "Automation started in the background. It will automatically log in and complete your courses!");
      
      // Clear form on success
      setUsername("");
      setPassword("");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "An unexpected error occurred while connecting to the backend.");
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-2xl">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            DIKSHA Cloud Automation
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Enter your DIKSHA credentials to automatically complete your pending courses in the background.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "success" && (
            <Alert className="mb-6 border-green-500 bg-green-50/10">
              <AlertTitle className="text-green-600 font-semibold">Started Successfully!</AlertTitle>
              <AlertDescription className="text-green-500">
                {message}
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                DIKSHA Username or Mobile
              </label>
              <Input 
                type="text" 
                placeholder="Enter your username..." 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={status === "loading"}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
              <Input 
                type="password" 
                placeholder="Enter your password..." 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === "loading"}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting Server...
                </>
              ) : (
                "Start Automation"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col text-sm text-gray-500 text-center border-t border-white/10 pt-6">
          <p>This runs silently on your backend server. Do not start multiple sessions simultaneously.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
