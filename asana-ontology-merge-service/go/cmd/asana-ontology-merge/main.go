package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/Pwatermelon/asana-ontology-merge/internal/compare"
	"github.com/Pwatermelon/asana-ontology-merge/internal/ui"
)

const version = "0.2.0"

func main() {
	root := &cobra.Command{
		Use:   "asana-ontology-merge",
		Short: "Preview merge двух OWL-онтологий (Go CLI · НИР)",
		Long: `Цветной терминальный клиент и ядро сравнения онтологий.

Собранный бинарник можно использовать локально как CLI.
Микросервис вызывает тот же бинарник из Python API-обёртки.`,
	}

	var (
		jsonPath   string
		limit      int
		jsonStdout bool
	)

	previewCmd := &cobra.Command{
		Use:   "preview <base.owl> <incoming.owl>",
		Short: "Сравнить две онтологии (added / removed / conflicts)",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			report, err := compare.CompareFiles(args[0], args[1])
			if err != nil {
				ui.RenderError(err.Error())
				return err
			}

			if jsonStdout || jsonPath != "" {
				raw, err := report.JSON()
				if err != nil {
					return err
				}
				if jsonPath != "" {
					if err := os.WriteFile(jsonPath, raw, 0o644); err != nil {
						return err
					}
					if !jsonStdout {
						fmt.Fprintf(os.Stdout, "JSON сохранён: %s\n", jsonPath)
					}
				}
				if jsonStdout {
					fmt.Println(string(raw))
					return nil
				}
			}

			ui.RenderReport(report, limit)
			return nil
		},
	}
	previewCmd.Flags().StringVar(&jsonPath, "json", "", "Записать полный отчёт в JSON-файл")
	previewCmd.Flags().BoolVar(&jsonStdout, "json-stdout", false, "Печать JSON в stdout (для API-обёртки)")
	previewCmd.Flags().IntVar(&limit, "limit", 15, "Сколько строк сущностей показать в TUI")

	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Версия бинарника",
		Run: func(cmd *cobra.Command, args []string) {
			ui.BannerVersion(version)
		},
	}

	root.AddCommand(previewCmd, versionCmd)
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}
